import { cycleKeyOf, fromIso, shiftMonth } from '../../domain/dates'
import { formatTLExact } from '../../domain/money'
import { cardTierFor, CURRENT_RATES } from '../../domain/rates'
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
 * Calculate the interest nudge for a card or KMH expense.
 * Returns formatted interest text or null if not applicable.
 */
export function interestNudge(account: CardAccount | KmhAccount, amount: Kurus): string | null {
  if (amount <= 0) return null

  // Use the interest rate for this amount
  let rate: number
  if (account.kind === 'card') {
    rate = account.rateOverride?.contractual ?? cardTierFor(amount, CURRENT_RATES).contractual
  } else {
    // KMH uses cash rate
    rate = account.rateOverride?.contractual ?? CURRENT_RATES.cash.contractual
  }

  // Estimate monthly interest: amount × rate/100 × 1.30 (taxes)
  const monthlyInterest = Math.round((amount * rate) / 100 * 1.3)

  if (monthlyInterest <= 0) return null

  return `Bu harcamayı ödemeyip taşırsan ayda ~${formatTLExact(monthlyInterest)} faiz işler.`
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
