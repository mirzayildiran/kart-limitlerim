import { cycleKeyOf, fromIso, shiftMonth } from '../../domain/dates'
import { formatTLExact } from '../../domain/money'
import { cardTierFor, CURRENT_RATES, withTaxes } from '../../domain/rates'
import type { Account, CardAccount, KmhAccount, Expense, IsoDate, Kurus } from '../../domain/types'

/**
 * Filter expenses by month (CycleKey format: "2026-10").
 */
export function expensesByMonth(expenses: Expense[], monthKey: string): Expense[] {
  return expenses.filter((e) => e.date.startsWith(monthKey))
}

/**
 * Group expenses by day, newest dates first, then by createdAt desc within a day.
 * Returns array of { date, day, expenses[] }.
 */
export function groupExpensesByDay(expenses: Expense[]): Array<{ date: IsoDate; day: string; expenses: Expense[] }> {
  const groups = new Map<IsoDate, Expense[]>()
  for (const e of expenses) {
    if (!groups.has(e.date)) groups.set(e.date, [])
    groups.get(e.date)!.push(e)
  }

  const fmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' })

  return Array.from(groups.entries())
    .map(([date, exps]) => ({
      date,
      day: fmt.format(fromIso(date)),
      expenses: exps.sort((a, b) => b.createdAt - a.createdAt),
    }))
    .sort((a, b) => b.date.localeCompare(a.date))
}

/**
 * Narrow expenses to one category and/or one account (both conditions must hold).
 * Without a filter the list is returned unchanged in order.
 */
export function filterExpenses(
  expenses: Expense[],
  filter: { categoryId?: string; accountId?: string } = {},
): Expense[] {
  return expenses.filter(
    (e) =>
      (filter.categoryId === undefined || e.categoryId === filter.categoryId) &&
      (filter.accountId === undefined || e.accountId === filter.accountId),
  )
}

/** Sum of one day's expenses in kuruş. */
export function dayTotal(expenses: Expense[]): Kurus {
  return expenses.reduce((sum, e) => sum + e.amount, 0)
}

/**
 * Sum expenses by category. Returns { categoryId, amount }.
 */
export function categoryTotals(expenses: Expense[]): Map<string, Kurus> {
  const totals = new Map<string, Kurus>()
  for (const e of expenses) {
    totals.set(e.categoryId, (totals.get(e.categoryId) ?? 0) + e.amount)
  }
  return totals
}

/**
 * Sum expenses by account. Returns { accountId, amount }.
 */
export function accountTotals(expenses: Expense[]): Map<string, Kurus> {
  const totals = new Map<string, Kurus>()
  for (const e of expenses) {
    totals.set(e.accountId, (totals.get(e.accountId) ?? 0) + e.amount)
  }
  return totals
}

/**
 * Faceted breakdowns. Each breakdown applies the OTHER filter only, so a category row
 * shows what it holds under the selected account, and an account tile shows what it
 * holds under the selected category. A selected filter never narrows its own row set.
 */
export function facetTotals(
  expenses: Expense[],
  filter: { categoryId?: string; accountId?: string } = {},
): { byCategory: Map<string, Kurus>; byAccount: Map<string, Kurus> } {
  return {
    byCategory: categoryTotals(filterExpenses(expenses, { accountId: filter.accountId })),
    byAccount: accountTotals(filterExpenses(expenses, { categoryId: filter.categoryId })),
  }
}

/**
 * A breakdown row is unavailable when it holds nothing under the other filter.
 * A selected row is never unavailable, so it stays clickable and can be cleared.
 */
export function isFacetDisabled(amount: Kurus, selected: boolean): boolean {
  return !selected && amount === 0
}

/**
 * Compute available before/after when adding/editing an expense.
 * Takes the old expense (null when creating), new expense, account, and current available.
 */
export function previewAvailable(
  oldExpense: Expense | null,
  newExpense: Expense,
  _account: Account,
  currentAvailable: Kurus,
): Kurus {
  let result = currentAvailable

  // Undo the old expense
  if (oldExpense?.affectsAccount && oldExpense.accountId === newExpense.accountId) {
    result += oldExpense.amount
  }

  // Apply the new expense
  if (newExpense.affectsAccount) {
    result -= newExpense.amount
  }

  return result
}

/**
 * Validate a category name: trim, 1–24 chars, no duplicates (case-insensitive, tr-TR).
 * Returns { valid: true } or { valid: false; error: string }.
 */
export function validateCategoryName(
  name: string,
  existingNames: string[],
): { valid: true } | { valid: false; error: string } {
  const trimmed = name.trim()

  if (trimmed.length === 0) {
    return { valid: false, error: 'Kategori adı boş olamaz.' }
  }

  if (trimmed.length > 24) {
    return { valid: false, error: 'Kategori adı 24 karaktere kadar olmalı.' }
  }

  const lower = trimmed.toLocaleLowerCase('tr-TR')
  const isDuplicate = existingNames.some((n) => n.toLocaleLowerCase('tr-TR') === lower)

  if (isDuplicate) {
    return { valid: false, error: 'Bu kategori zaten var.' }
  }

  return { valid: true }
}

/**
 * Estimated monthly interest (kuruş) if a card or KMH expense is carried over unpaid.
 * amount × monthly contractual rate × 1.30 (KKDF + BSMV). Null when there is nothing to show.
 */
export function interestNudgeAmount(account: CardAccount | KmhAccount, amount: Kurus): Kurus | null {
  if (amount <= 0) return null

  // The card tier follows the statement debt, so the rate is the one for what is used plus this
  // expense; KMH uses the cash rate.
  const used = Math.max(0, account.limit - account.available)
  const rate =
    account.kind === 'card'
      ? account.rateOverride?.contractual ?? cardTierFor(used + amount, CURRENT_RATES).contractual
      : account.rateOverride?.contractual ?? CURRENT_RATES.cash.contractual

  const monthlyInterest = Math.round(withTaxes((amount * rate) / 100))
  return monthlyInterest > 0 ? monthlyInterest : null
}

/**
 * The interest nudge as one sentence. The sheet renders the figure on its own
 * (see interestNudgeAmount) so only the figure takes the rose colour.
 */
export function interestNudge(account: CardAccount | KmhAccount, amount: Kurus): string | null {
  const monthly = interestNudgeAmount(account, amount)
  if (monthly === null) return null
  return `Bu harcamayı ödemeyip taşırsan ayda ~${formatTLExact(monthly)} faiz işler.`
}

/**
 * Get the previous and next month keys relative to the given month.
 */
export function monthNavigation(key: string): { prev: string; next: string | null } {
  const prev = shiftMonth(key, -1)

  // Can't go past the current month
  const currentMonth = cycleKeyOf(new Date())
  const next = key !== currentMonth ? shiftMonth(key, 1) : null

  return { prev, next }
}
