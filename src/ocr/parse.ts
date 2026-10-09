import { parseTL } from '../domain/money'
import { startOfDay } from '../domain/dates'
import type { IsoDate, Kurus } from '../domain/types'
import { fold } from './text'
import type { BankProfileId, OcrPage, OcrWord, ParsedTxn, ParseResult } from './types'

/** Stacked date parts live left of this share of the page width. */
const LEFT_COLUMN = 0.2
/** Stacked date parts may sit this many word heights apart. */
const DATE_REACH = 3
/** A text line joins the nearest row only within this many word heights. */
const ROW_REACH = 2.5
/** Month/year parts must sit within this many px of their day token. */
const COLUMN_TOLERANCE = 40
/** A "Toplam" line this close (in line heights) marks an amount as a total, not a row. */
const TOTAL_REACH = 1.6

/** Sign may be OCR'd as "*" for "+". */
const AMOUNT_RE = /^([+\-−*]?)(\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2}|\d+\.\d{2})$/
const TL_RE = /^(tl|try|₺)$/i
const TL_SUFFIX_RE = /(tl|try|₺)$/i
const FULL_DATE_RE = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/
const TIME_RE = /^\d{1,2}:\d{2}$/
const YEAR_RE = /^\d{4}$/

/** Whole-word month names and abbreviations, folded (so "eyl" and "eyi" both mean September). */
const MONTH_WORDS: Partial<Record<string, number>> = {
  oca: 1, ocak: 1, sub: 2, subat: 2, mar: 3, mart: 3, nis: 4, nisan: 4, may: 5, mayis: 5,
  haz: 6, haziran: 6, tem: 7, temmuz: 7, agu: 8, agustos: 8, eyl: 9, eyi: 9, eylul: 9,
  eki: 10, ekim: 10, kas: 11, kasim: 11, ara: 12, aralik: 12,
}

const HEADER_RE = /toplam|bonus|son donem|donem ici harcamalar|hesap ozeti|harcama tutar|\blimit\b/
const UI_RE = /borc ode|limit artir|ertele|taksitlendir|donem ici|bekleyen|gelecek donem|ana sayfa|transfer ve odeme|basvurular|senin icin|filtrele/
/** Words that only appear in app chrome (tab bar, status bar, search box). A line made only of these is dropped. */
const CHROME_TOKENS = new Set([
  'ara', 'lte', '4g', 'menu', 'hesaplarim', 'islemler', 'kartlarim', 'hayatim', 'durumum',
  'ana', 'sayfa', 'transfer', 've', 'odemeler', 'hesap', 'kart', 'senin', 'icin', 'basvurular',
  'ba', 'ri', 'fa', 'va', 'el', 'o',
])
/** Single OCR glyphs that are noise when they stand alone inside a description. */
const GLYPH_TOKENS = new Set(['ba', 'ri', 'fa', 'va', 'el', 'lte', '4g'])
const INSTALLMENT_NOISE_RE = /islemin|taksid|taksit/
const INSTALLMENT_TOKEN_RE = /\b\d{1,2}\s*\/\s*\d{1,2}\s*tak\w*|\b\d{1,2}\s*\.\s*tak\w*/gi
const BARE_FRACTION_RE = /^\d{1,2}\s*\/\s*\d{1,2}\)?$/
/** Run on folded row text (lowercase, no diacritics). */
const INSTALLMENT_COUNT_RE = /(\d{1,2})\s*\/\s*(\d{1,2})\s*taksi[dt]/
const INSTALLMENT_TOTAL_RE = /\(\s*([\d.,]+)\s*tl\s*islemin/
const INSTALLMENT_LINE_RE = /islemin/
const CREDIT_RE = /odeme|tesekk|iade/
const TRANSFER_RE = /karttan|aktarim/
const TIME_TAIL_RE = /\s*(?:[-–]\s*)?\d{1,2}:\d{2}$/
const SECTION_PENDING = 'beklemede'
const SECTION_BOOKED = 'gerceklesen'

interface Line {
  words: OcrWord[]
  text: string
  y0: number
  y1: number
}

interface Span {
  y0: number
  y1: number
}

interface DateBlock extends Span {
  date: IsoDate | null
  /** A month or year was missing and borrowed from the previous row. */
  inferred: boolean
}

interface Amount {
  word: OcrWord
  sign: string
  kurus: Kurus
}

interface Anchor {
  line: Line
  amount: Amount
  pending: boolean
  dateBlock: { date: IsoDate | null; inferred: boolean; dist: number; y0: number } | null
  others: Line[]
}

/** Guess which bank app the screenshot comes from. */
export function detectProfile(page: OcrPage): BankProfileId {
  const t = fold(page.words.map((w) => w.text).join(' '))
  if (t.includes('bankkart')) return 'ziraat-bankkart'
  // Both Ziraat apps show "Provizyondaki İşlemler"; without BANKKART it is the Dinamik app.
  if (t.includes('provizyondaki') || t.includes('dinamik')) return 'ziraat-dinamik'
  if (t.includes('kredi karti') && t.includes('gelecek donem')) return 'akbank'
  if (t.includes('donem ici') && t.includes('taksitler') && t.includes('hesap ozeti')) return 'isbank'
  if (t.includes('bonus') || t.includes('son donem ici hareketleri')) return 'garanti'
  return 'generic'
}

/** Turn OCR words into transactions. `today` resolves dates without a year. */
export function parsePage(page: OcrPage, today: Date, profile?: BankProfileId): ParseResult {
  const id = profile ?? detectProfile(page)
  const W = page.width
  const H = medianHeight(page.words)
  const gap = ROW_REACH * H
  const { blocks, dateWords } = buildDateBlocks(page.words, W, H, today)
  const lines = groupLines(page.words, H)
  const skipped: string[] = []
  const anchors: Anchor[] = []
  const others: Line[] = []

  let pending = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const folded = fold(line.text)
    if (HEADER_RE.test(folded)) {
      skipped.push(line.text)
      continue
    }
    if (folded === SECTION_PENDING || folded === SECTION_BOOKED) {
      pending = folded === SECTION_PENDING
      skipped.push(line.text)
      continue
    }
    if (UI_RE.test(folded) || isChromeLine(folded)) continue
    const amount = findAmount(line, dateWords)
    if (amount && nearTotal(lines, i, H)) {
      skipped.push(line.text)
      continue
    }
    if (amount && !INSTALLMENT_LINE_RE.test(folded)) {
      anchors.push({ line, amount, pending, dateBlock: null, others: [] })
    } else {
      others.push(line)
    }
  }

  for (const b of blocks) {
    const hit = nearest(anchors, b, gap)
    if (hit && (!hit.anchor.dateBlock || hit.dist < hit.anchor.dateBlock.dist)) {
      hit.anchor.dateBlock = { date: b.date, inferred: b.inferred, dist: hit.dist, y0: b.y0 }
    }
  }
  // Pass 1: lines close to an anchor. Pass 2 (below) gives the rest to the row band they sit in.
  const orphans: Line[] = []
  for (const l of others) {
    const hit = nearest(anchors, l, gap)
    if (hit) hit.anchor.others.push(l)
    else orphans.push(l)
  }
  // A row's top is its first element: date block, amount line or description line. Its band runs down to the next row's top.
  const tops = anchors.map((a) =>
    Math.min(a.line.y0, a.dateBlock?.y0 ?? Infinity, ...a.others.map((l) => l.y0)),
  )
  for (const l of orphans) {
    let owner = -1
    for (let i = 0; i < anchors.length; i++) if (tops[i] <= l.y0) owner = i
    if (owner >= 0) anchors[owner].others.push(l)
    else if (textOf(l.words, dateWords)) skipped.push(l.text)
  }

  const txns: ParsedTxn[] = []
  for (const a of anchors) {
    const rowLines = [a.line, ...a.others].sort((p, q) => p.y0 - q.y0)
    const raw = rowLines.map((l) => l.text).join('\n')

    const leftWords = a.line.words.filter((w) => w.x0 < a.amount.word.x0)
    let parts = [
      { y0: a.line.y0, text: cleanPiece(textOf(leftWords, dateWords)) },
      ...a.others.map((l) => ({ y0: l.y0, text: cleanPiece(textOf(l.words, dateWords)) })),
    ]
      .filter((p) => p.text !== '')
      .sort((p, q) => p.y0 - q.y0)

    const splitCategory = id === 'garanti' && parts.length >= 2
    const bankPiece = splitCategory ? parts[0].text : null
    if (splitCategory) parts = parts.slice(1)
    const description = parts
      .map((p) => p.text)
      .join(' ')
      .replace(TIME_TAIL_RE, '')
      .replace(/\s+/g, ' ')
      .trim()

    if (TRANSFER_RE.test(fold(description))) {
      skipped.push(rowLines.map((l) => l.text).join(' '))
      continue
    }

    const credit = a.amount.sign === '+' || a.amount.sign === '*' || CREDIT_RE.test(fold(description))
    // Credits (payments, refunds) carry no spending category from the bank.
    const bankCategory = credit ? null : bankPiece

    // Installment info may be split across lines, so search the whole row band.
    const folded = fold(rowLines.map((l) => l.text).join(' '))
    const count = INSTALLMENT_COUNT_RE.exec(folded)
    const totalMatch = INSTALLMENT_TOTAL_RE.exec(folded)
    const total = totalMatch ? parseTL(normaliseDecimal(totalMatch[1])) : null
    const installment = count
      ? { index: Number(count[1]), count: Number(count[2]), ...(total !== null ? { total } : {}) }
      : null

    const words = rowLines.flatMap((l) => l.words)
    const meanConf = words.reduce((s, w) => s + w.confidence, 0) / words.length
    const date = a.dateBlock?.date ?? null
    let c = 1
    if (!date) c -= 0.3
    if (a.dateBlock?.inferred) c -= 0.2
    if (meanConf < 70) c -= 0.2
    if (!description) c -= 0.2
    const confidence = Math.round(Math.min(1, Math.max(0, c)) * 100) / 100

    txns.push({
      date,
      description,
      amount: a.amount.kurus,
      direction: credit ? 'credit' : 'debit',
      pending: a.pending,
      installment,
      bankCategory,
      confidence,
      raw,
    })
  }
  return { profile: id, txns, skipped }
}

function medianHeight(words: OcrWord[]): number {
  const hs = words.map((w) => w.y1 - w.y0).filter((h) => h > 0).sort((a, b) => a - b)
  return hs.length ? hs[Math.floor(hs.length / 2)] : 1
}

const centre = (w: OcrWord) => (w.y0 + w.y1) / 2

/** Group words into lines by vertical centre (within 0.6 × median word height). */
function groupLines(words: OcrWord[], H: number): Line[] {
  const sorted = words.filter((w) => w.text.trim()).sort((a, b) => centre(a) - centre(b))
  const groups: { words: OcrWord[]; sum: number }[] = []
  for (const w of sorted) {
    const c = centre(w)
    const g = groups.at(-1)
    if (g && Math.abs(c - g.sum / g.words.length) <= 0.6 * H) {
      g.words.push(w)
      g.sum += c
    } else {
      groups.push({ words: [w], sum: c })
    }
  }
  return groups.map((g) => {
    const ws = [...g.words].sort((a, b) => a.x0 - b.x0)
    return {
      words: ws,
      text: ws.map((w) => w.text).join(' '),
      y0: Math.min(...ws.map((w) => w.y0)),
      y1: Math.max(...ws.map((w) => w.y1)),
    }
  })
}

function isChromeLine(folded: string): boolean {
  const tokens = folded.split(/\s+/).filter(Boolean)
  return tokens.length > 0 && tokens.every((t) => CHROME_TOKENS.has(t) || !/[\p{L}\p{N}]/u.test(t))
}

function parseAmount(text: string): { sign: string; kurus: Kurus } | null {
  const m = AMOUNT_RE.exec(text.replace(TL_SUFFIX_RE, ''))
  if (!m) return null
  const kurus = parseTL(normaliseDecimal(m[2]))
  return kurus === null ? null : { sign: m[1], kurus }
}

/** "430.00" (OCR dot decimal) → "430,00"; other forms pass through. */
function normaliseDecimal(s: string): string {
  return /^\d+\.\d{2}$/.test(s) ? s.replace('.', ',') : s
}

function findAmount(line: Line, dateWords: Set<OcrWord>): Amount | null {
  let found: Amount | null = null
  for (let i = 0; i < line.words.length; i++) {
    const w = line.words[i]
    if (dateWords.has(w)) continue
    const next = line.words[i + 1]
    if (next && /^(usd|eur)$/i.test(next.text)) continue // foreign-currency totals
    const parsed = parseAmount(w.text)
    if (parsed && parsed.kurus > 0) found = { word: w, ...parsed }
  }
  return found
}

/** True when a "Toplam" line sits right above or below this line. */
function nearTotal(lines: Line[], i: number, H: number): boolean {
  const reach = TOTAL_REACH * H
  const line = lines[i]
  return [lines[i - 1], lines[i + 1]].some(
    (o) => o !== undefined && /toplam/.test(fold(o.text)) && Math.max(0, o.y0 - line.y1, line.y0 - o.y1) <= reach,
  )
}

/** Words that are neither dates, amounts nor "TL", as one string. */
function textOf(words: OcrWord[], dateWords: Set<OcrWord>): string {
  return words
    .filter((w) => !dateWords.has(w) && !TL_RE.test(w.text) && parseAmount(w.text) === null)
    .map((w) => w.text)
    .join(' ')
}

/** Drop installment fragments, OCR glyph tokens, leading icon glyphs and bare "3/3" fractions. */
function cleanPiece(text: string): string {
  if (INSTALLMENT_NOISE_RE.test(fold(text))) return ''
  const tokens = text
    .replace(INSTALLMENT_TOKEN_RE, ' ')
    .split(/\s+/)
    .filter((t) => t !== '' && !BARE_FRACTION_RE.test(t) && !GLYPH_TOKENS.has(fold(t)))
  // Icon glyphs read as "&" or "£" can only lead a description; interior punctuation (dashes) stays.
  const firstWord = tokens.findIndex((t) => /[\p{L}\p{N}]/u.test(t))
  return firstWord === -1 ? '' : tokens.slice(firstWord).join(' ')
}

/** "dd" or glued "dd/x)" → day number; null when the text is not a day. */
function dayOf(text: string): number | null {
  const m = /^(\d{1,2})(?![\d.,:])/.exec(text)
  if (!m || /\p{L}/u.test(text)) return null
  const d = Number(m[1])
  return d >= 1 && d <= 31 ? d : null
}

/** Whole word only: "Market" is not "Mar". */
function monthOf(text: string): number | null {
  return MONTH_WORDS[fold(text).replace(/[^a-z]/g, '')] ?? null
}

function isoOf(y: number, m: number, d: number): IsoDate | null {
  const dt = new Date(y, m - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** No year printed: the most recent such day on or before today. */
function resolveNoYear(day: number, month: number, today: Date): IsoDate | null {
  const now = startOfDay(today)
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const y = now.getFullYear()
  const candidates = [isoOf(y, month, day), isoOf(y - 1, month, day)].filter(
    (c): c is string => c !== null && c <= todayIso,
  )
  return candidates.sort().at(-1) ?? null
}

/**
 * Date blocks, from full "dd.mm.yyyy" words and from stacked left-column parts:
 *  - day, month and year-or-time, stacked (the normal case);
 *  - a missing month, or a cut-off row with only the day, borrows the previous block's month (and year);
 *  - a month with no day above it gives a block with a null date (the review UI asks the user).
 */
function buildDateBlocks(
  words: OcrWord[],
  W: number,
  H: number,
  today: Date,
): { blocks: DateBlock[]; dateWords: Set<OcrWord> } {
  const dateWords = new Set<OcrWord>()
  const blocks: DateBlock[] = []
  for (const w of words) {
    const m = FULL_DATE_RE.exec(w.text)
    if (!m) continue
    dateWords.add(w)
    blocks.push({ y0: w.y0, y1: w.y1, date: isoOf(Number(m[3]), Number(m[2]), Number(m[1])), inferred: false })
  }

  const left = words.filter((w) => w.x0 < LEFT_COLUMN * W && !dateWords.has(w)).sort((p, q) => p.y0 - q.y0)
  const reach = DATE_REACH * H
  const free = (c: OcrWord) => !dateWords.has(c)
  const sameColumn = (a: OcrWord, b: OcrWord) => Math.abs(a.x0 - b.x0) <= COLUMN_TOLERANCE
  const below = (from: OcrWord, ok: (w: OcrWord) => boolean) =>
    left.find((c) => free(c) && c !== from && c.y0 >= from.y0 && c.y0 - from.y1 <= reach && ok(c))

  let lastMonth: number | null = null
  let lastYear: number | null = null

  // Pass 1: day first, then month and year/time below it.
  for (const dayWord of left) {
    if (!free(dayWord)) continue
    const day = dayOf(dayWord.text)
    if (day === null) continue
    const mo = below(dayWord, (c) => monthOf(c.text) !== null && sameColumn(c, dayWord))
    const monthNow = mo ? monthOf(mo.text) : null
    if (monthNow === null && lastMonth === null) continue
    const month: number = monthNow ?? lastMonth ?? 0
    const tail = below(mo ?? dayWord, (c) => YEAR_RE.test(c.text) || (monthNow !== null && TIME_RE.test(c.text)))

    let year: number | null = tail && YEAR_RE.test(tail.text) ? Number(tail.text) : null
    let inferred = monthNow === null
    if (year !== null) lastYear = year
    else if (monthNow === null && lastYear !== null) {
      year = lastYear
      inferred = true
    }
    const date = year !== null ? isoOf(year, month, day) : resolveNoYear(day, month, today)
    for (const x of [dayWord, mo, tail]) if (x) dateWords.add(x)
    lastMonth = month
    blocks.push({ y0: dayWord.y0, y1: (tail ?? mo ?? dayWord).y1, date, inferred })
  }

  // Pass 2: a month that no day claimed. Needs a year or time below, so a description word is never a month.
  for (const mo of left) {
    if (!free(mo)) continue
    const month = monthOf(mo.text)
    if (month === null) continue
    const tail = below(mo, (c) => YEAR_RE.test(c.text) || TIME_RE.test(c.text))
    const dayAbove = left
      .filter((d) => free(d) && d !== mo && d.y1 <= mo.y0 + 1 && mo.y0 - d.y1 <= reach && sameColumn(d, mo) && dayOf(d.text) !== null)
      .sort((p, q) => q.y0 - p.y0)[0]
    if (!tail && !dayAbove) continue
    const day = dayAbove ? dayOf(dayAbove.text) : null
    const year = tail && YEAR_RE.test(tail.text) ? Number(tail.text) : null
    if (year !== null) lastYear = year
    const date = day === null ? null : year !== null ? isoOf(year, month, day) : resolveNoYear(day, month, today)
    for (const x of [dayAbove, mo, tail]) if (x) dateWords.add(x)
    lastMonth = month
    blocks.push({ y0: (dayAbove ?? mo).y0, y1: (tail ?? mo).y1, date, inferred: false })
  }
  return { blocks, dateWords }
}

/** Nearest anchor by vertical gap, if within reach. */
function nearest(anchors: Anchor[], span: Span, gap: number): { anchor: Anchor; dist: number } | null {
  let best: { anchor: Anchor; dist: number } | null = null
  for (const a of anchors) {
    const dist = Math.max(0, a.line.y0 - span.y1, span.y0 - a.line.y1)
    if (dist <= gap && (!best || dist < best.dist)) best = { anchor: a, dist }
  }
  return best
}
