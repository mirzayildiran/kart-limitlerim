import type { Expense, IsoDate, Kurus, MerchantRule } from '../../domain/types'
import type { ParsedTxn } from '../../ocr/types'

/** Rows below this parser confidence are not preselected and get a "Kontrol et" pill. */
const CONFIDENCE_MIN = 0.5

/** One editable row on the review screen. Only debits become rows. */
export interface DraftRow {
  uid: string
  date: IsoDate | null
  amount: Kurus | null
  description: string
  categoryId: string
  suggestedCategoryId: string
  installments: number
  pending: boolean
  lowConfidence: boolean
  duplicate: boolean
  selected: boolean
}

type ImportableRow = DraftRow & { date: IsoDate; amount: Kurus }

function normalizeText(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLocaleLowerCase('tr-TR')
}

/** Key used to recognise the same transaction seen on two overlapping screenshots. */
export function dedupeKey(t: Pick<ParsedTxn, 'date' | 'amount' | 'description'>): string {
  return `${t.date ?? ''}|${t.amount}|${normalizeText(t.description)}`
}

/**
 * Merge the rows of several screenshots. A transaction that appears on more
 * than one image is kept once, but two identical purchases on the same image
 * (same day, amount and merchant) are both kept: each image contributes the
 * maximum count it showed for a key.
 */
export function mergeAcrossImages(perImage: ParsedTxn[][]): ParsedTxn[] {
  const kept = new Map<string, number>()
  const out: ParsedTxn[] = []
  for (const list of perImage) {
    const seenHere = new Map<string, number>()
    for (const t of list) {
      const key = dedupeKey(t)
      const count = (seenHere.get(key) ?? 0) + 1
      seenHere.set(key, count)
      if (count > (kept.get(key) ?? 0)) {
        kept.set(key, count)
        out.push(t)
      }
    }
  }
  return out
}

export function splitTxns(txns: ParsedTxn[]): { debits: ParsedTxn[]; credits: ParsedTxn[] } {
  return {
    debits: txns.filter((t) => t.direction === 'debit'),
    credits: txns.filter((t) => t.direction === 'credit'),
  }
}

/** True when an expense with the same account, date and amount is already stored. */
export function isAlreadyRecorded(
  t: Pick<ParsedTxn, 'date' | 'amount'>,
  accountId: string,
  expenses: Expense[],
): boolean {
  if (!t.date) return false
  return expenses.some((e) => e.accountId === accountId && e.date === t.date && e.amount === t.amount)
}

/** Checked by default: debit, readable, confidence at least CONFIDENCE_MIN, not already recorded. */
export function defaultSelected(t: ParsedTxn, duplicate: boolean): boolean {
  return t.direction === 'debit' && t.date !== null && t.confidence >= CONFIDENCE_MIN && !duplicate
}

export function buildDrafts(
  debits: ParsedTxn[],
  ctx: { accountId: string; expenses: Expense[]; suggest: (t: ParsedTxn) => string },
): DraftRow[] {
  return debits.map((t, i) => {
    const duplicate = isAlreadyRecorded(t, ctx.accountId, ctx.expenses)
    const suggested = ctx.suggest(t)
    return {
      uid: `row-${i}`,
      date: t.date,
      amount: t.amount,
      description: t.description,
      categoryId: suggested,
      suggestedCategoryId: suggested,
      installments: t.installment?.count ?? 1,
      pending: t.pending,
      lowConfidence: t.confidence < CONFIDENCE_MIN,
      duplicate,
      selected: defaultSelected(t, duplicate),
    }
  })
}

export function isImportable(r: DraftRow): r is ImportableRow {
  return r.date !== null && r.amount !== null && r.amount > 0
}

export function selectedRows(rows: DraftRow[]): ImportableRow[] {
  return rows.filter((r): r is ImportableRow => r.selected && isImportable(r))
}

export function summarize(rows: DraftRow[]): { count: number; total: Kurus } {
  const picked = selectedRows(rows)
  return { count: picked.length, total: picked.reduce((sum, r) => sum + r.amount, 0) }
}

export function buildExpenses(
  rows: DraftRow[],
  opts: { accountId: string; affectsAccount: boolean; now: number; makeId: () => string },
): Expense[] {
  return selectedRows(rows).map((r) => ({
    id: opts.makeId(),
    amount: r.amount,
    categoryId: r.categoryId,
    accountId: opts.accountId,
    date: r.date,
    note: r.description,
    affectsAccount: opts.affectsAccount,
    installments: r.installments,
    source: 'screenshot',
    recurringId: null,
    createdAt: opts.now,
  }))
}

/**
 * Rules to save after an import: every imported row whose category the user
 * changed from the suggestion teaches its merchant key. An existing rule with
 * the same pattern gets the new category and one more hit.
 */
export function learnRules(
  imported: DraftRow[],
  rules: MerchantRule[],
  keyOf: (description: string) => string,
  makeId: () => string,
): MerchantRule[] {
  const working = new Map(rules.map((r) => [r.pattern, r]))
  const changed = new Map<string, MerchantRule>()
  for (const r of imported) {
    if (r.categoryId === r.suggestedCategoryId) continue
    const pattern = keyOf(r.description)
    if (!pattern) continue
    const prev = working.get(pattern)
    const next: MerchantRule = prev
      ? { ...prev, categoryId: r.categoryId, hits: prev.hits + 1 }
      : { id: makeId(), pattern, categoryId: r.categoryId, hits: 1 }
    working.set(pattern, next)
    changed.set(pattern, next)
  }
  return [...changed.values()]
}
