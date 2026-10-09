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

/** Sign may be OCR'd as "*" for "+". */
const AMOUNT_RE = /^([+\-−*]?)(\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2}|\d+\.\d{2})$/
const TL_RE = /^(tl|try|₺)$/i
const TL_SUFFIX_RE = /(tl|try|₺)$/i
const FULL_DATE_RE = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/
const TIME_RE = /^\d{1,2}:\d{2}$/
const YEAR_RE = /^\d{4}$/

/** Keys are the first three folded letters with "l" read as "i" (OCR: EYL ↔ EYİ). */
const MONTHS: Partial<Record<string, number>> = {
  oca: 1, sub: 2, mar: 3, nis: 4, may: 5, haz: 6, tem: 7, agu: 8, eyi: 9,
  eki: 10, kas: 11, ara: 12,
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
const INSTALLMENT_COUNT_RE = /(\d{1,2})\s*\/\s*(\d{1,2})\s*tak/
const INSTALLMENT_TOTAL_RE = /\(\s*([\d.,]+)\s*(?:tl)?\s*islemin/
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
  /** Month was missing and borrowed from the previous row. */
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
  dateBlock: { date: IsoDate | null; inferred: boolean; dist: number } | null
  others: Line[]
}

/** Guess which bank app the screenshot comes from. */
export function detectProfile(page: OcrPage): BankProfileId {
  const t = fold(page.words.map((w) => w.text).join(' '))
  if (t.includes('bankkart')) return 'ziraat-bankkart'
  if (t.includes('dinamik') || (t.includes('donem ici hareketler') && t.includes('provizyondaki'))) return 'ziraat-dinamik'
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
  for (const line of lines) {
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
    if (amount && !INSTALLMENT_LINE_RE.test(folded)) {
      anchors.push({ line, amount, pending, dateBlock: null, others: [] })
    } else {
      others.push(line)
    }
  }

  for (const b of blocks) {
    const hit = nearest(anchors, b, gap)
    if (hit && (!hit.anchor.dateBlock || hit.dist < hit.anchor.dateBlock.dist)) {
      hit.anchor.dateBlock = { date: b.date, inferred: b.inferred, dist: hit.dist }
    }
  }
  for (const l of others) {
    const hit = nearest(anchors, l, gap)
    if (hit) hit.anchor.others.push(l)
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

    let bankCategory: string | null = null
    if (id === 'garanti' && parts.length >= 2) {
      bankCategory = parts[0].text
      parts = parts.slice(1)
    }
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

    const folded = fold(raw)
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

    const credit = a.amount.sign === '+' || a.amount.sign === '*' || CREDIT_RE.test(fold(description))
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
  for (const w of line.words) {
    if (dateWords.has(w)) continue
    const parsed = parseAmount(w.text)
    if (parsed) found = { word: w, ...parsed }
  }
  return found
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

function monthOf(text: string): number | null {
  const f = fold(text)
  if (!/^[a-z]{3,9}$/.test(f)) return null
  return MONTHS[f.slice(0, 3).replace(/l/g, 'i')] ?? null
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
 * Date blocks: full "dd.mm.yyyy" words, and stacked left-column parts
 * (day / month / year-or-time). A missing month borrows the previous block's.
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
  const below = (from: OcrWord, ok: (w: OcrWord) => boolean) =>
    left.find((c) => !dateWords.has(c) && c !== from && c.y0 >= from.y0 && c.y0 - from.y1 <= reach && ok(c))

  let lastMonth: number | null = null
  for (const dayWord of left) {
    if (dateWords.has(dayWord)) continue
    const day = dayOf(dayWord.text)
    if (day === null) continue

    const mo = below(dayWord, (c) => monthOf(c.text) !== null)
    const monthNow = mo ? monthOf(mo.text) : null
    let month = monthNow
    let inferred = false
    if (month === null) {
      if (lastMonth === null || !below(dayWord, (c) => YEAR_RE.test(c.text))) continue
      month = lastMonth
      inferred = true
    }
    const tail = below(mo ?? dayWord, (c) => YEAR_RE.test(c.text) || (monthNow !== null && TIME_RE.test(c.text)))
    const date =
      tail && YEAR_RE.test(tail.text) ? isoOf(Number(tail.text), month, day) : resolveNoYear(day, month, today)
    for (const x of [dayWord, mo, tail]) if (x) dateWords.add(x)
    lastMonth = month
    blocks.push({ y0: dayWord.y0, y1: (tail ?? mo ?? dayWord).y1, date, inferred })
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
