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

/** One line per card tier, e.g. "30.000 ₺ altı: akdi %3,25 · gecikme %3,55". */
export function cardRateLines(table: RateTable = CURRENT_RATES): string[] {
  return table.cardTiers.map((t, i) => {
    const lower = i > 0 ? table.cardTiers[i - 1].upTo : null
    let range: string
    if (t.upTo === null) range = lower === null ? 'Tüm limitler' : `${formatTL(lower)} üzeri`
    else if (lower === null) range = `${formatTL(t.upTo)} altı`
    else range = `${formatTL(lower)} – ${formatTL(t.upTo)} arası`
    return `${range}: akdi %${formatPercent(t.contractual)} · gecikme %${formatPercent(t.late)}`
  })
}

export function cashRateLine(table: RateTable = CURRENT_RATES): string {
  return `Nakit çekim ve KMH: akdi %${formatPercent(table.cash.contractual)} · gecikme %${formatPercent(table.cash.late)}`
}

export function taxLine(taxes: { kkdf: number; bsmv: number } = INTEREST_TAXES): string {
  return `KKDF %${formatPercent(taxes.kkdf * 100)} + BSMV %${formatPercent(taxes.bsmv * 100)}`
}

export function minimumLine(rule: MinimumRule = MINIMUM_RULE): string {
  return `Asgari ödeme: limit ${formatTL(rule.threshold)}'ye kadar %${formatPercent(rule.lowRatio * 100)}, üstü %${formatPercent(rule.highRatio * 100)}`
}

/** "Kaynak: TCMB …, 1 Ekim 2026 itibarıyla geçerli" */
export function sourceLine(source: string, effective: IsoDate): string {
  return `Kaynak: ${source}, ${formatLongDate(effective)} itibarıyla geçerli`
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
