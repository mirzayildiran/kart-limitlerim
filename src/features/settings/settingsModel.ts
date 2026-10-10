import { formatTL } from '../../domain/money'
import { CURRENT_RATES, INTEREST_TAXES, MINIMUM_RULE, type MinimumRule, type RateTable } from '../../domain/rates'
import type { IsoDate } from '../../domain/types'

/** Pure helpers for the settings screens. No DOM, no storage. */

const TR_MONTHS = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
]

const pctFmt = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 })

/** Local calendar date in the backup file name: kart-limitlerim-yedek-2026-10-10.json */
export function backupFileName(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `kart-limitlerim-yedek-${d.getFullYear()}-${m}-${day}.json`
}

/** 3.25 → "3,25"; 20 → "20". */
export function formatPercent(p: number): string {
  return pctFmt.format(p)
}

/** "2026-10-01" → "1 Ekim 2026". */
export function formatLongDate(iso: IsoDate): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} ${TR_MONTHS[m - 1]} ${y}`
}

export interface RateRow {
  /** What the figures apply to, e.g. "30.000 ₺ altı". */
  label: string
  /** The figures, e.g. "akdi %3,25 · gecikme %3,55". */
  value: string
}

/**
 * Rows of the "Faiz nasıl tahmin ediliyor" list: one per card tier, then cash and KMH,
 * the KKDF + BSMV taxes, and the minimum-payment rule.
 */
export function rateRows(
  table: RateTable = CURRENT_RATES,
  taxes: { kkdf: number; bsmv: number } = INTEREST_TAXES,
  rule: MinimumRule = MINIMUM_RULE,
): RateRow[] {
  const cards = table.cardTiers.map((t, i): RateRow => {
    const lower = i > 0 ? table.cardTiers[i - 1].upTo : null
    let label: string
    if (t.upTo === null) label = lower === null ? 'Tüm limitler' : `${formatTL(lower)} üzeri`
    else if (lower === null) label = `${formatTL(t.upTo)} altı`
    else label = `${formatTL(lower)} – ${formatTL(t.upTo)} arası`
    return { label, value: `akdi %${formatPercent(t.contractual)} · gecikme %${formatPercent(t.late)}` }
  })
  return [
    ...cards,
    {
      label: 'Nakit çekim ve KMH',
      value: `akdi %${formatPercent(table.cash.contractual)} · gecikme %${formatPercent(table.cash.late)}`,
    },
    { label: 'KKDF + BSMV', value: `%${formatPercent(taxes.kkdf * 100)} + %${formatPercent(taxes.bsmv * 100)}` },
    {
      label: `Asgari ödeme, limit ${formatTL(rule.threshold)} ve altı`,
      value: `%${formatPercent(rule.lowRatio * 100)} · üstü %${formatPercent(rule.highRatio * 100)}`,
    },
  ]
}

/** "Kaynak: TCMB …, 1 Ekim 2026 itibarıyla geçerli" */
export function sourceLine(source: string, effective: IsoDate): string {
  return `Kaynak: ${source}, ${formatLongDate(effective)} itibarıyla geçerli`
}

/** Source captions under the rate list: the card and cash table, then the minimum-payment rule. */
export function sourceLines(table: RateTable = CURRENT_RATES, rule: MinimumRule = MINIMUM_RULE): string[] {
  return [sourceLine(table.source, table.effective), sourceLine(rule.source, rule.effective)]
}

export const CATEGORY_NAME_MAX = 24

export type NameCheck = { ok: true; name: string } | { ok: false; error: string }

/**
 * Validate a category name. Trims and collapses spaces, counts characters
 * (not bytes), and compares case-insensitively with Turkish rules
 * ("ULAŞIM" equals "Ulaşım"). `selfId` excludes the category being edited.
 */
export function checkCategoryName(input: string, others: { id: string; name: string }[], selfId?: string): NameCheck {
  const name = input.trim().replace(/\s+/g, ' ')
  const length = [...name].length
  if (length === 0) return { ok: false, error: 'Kategori adı boş olamaz.' }
  if (length > CATEGORY_NAME_MAX) return { ok: false, error: `Kategori adı en fazla ${CATEGORY_NAME_MAX} karakter olabilir.` }
  const key = name.toLocaleLowerCase('tr-TR')
  if (others.some((c) => c.id !== selfId && c.name.trim().toLocaleLowerCase('tr-TR') === key)) {
    return { ok: false, error: 'Bu adda bir kategori zaten var.' }
  }
  return { ok: true, name }
}

/** Builtin categories are never deleted (archive instead). User categories only when nothing uses them. */
export function canDeleteCategory(category: { builtin: boolean }, inUse: boolean): boolean {
  return !category.builtin && !inUse
}

export function isCategoryInUse(
  categoryId: string,
  expenses: { categoryId: string }[],
  recurring: { categoryId: string }[],
): boolean {
  return expenses.some((e) => e.categoryId === categoryId) || recurring.some((r) => r.categoryId === categoryId)
}
