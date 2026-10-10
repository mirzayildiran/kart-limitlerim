import type { Account, Expense, Kurus } from './types'

/**
 * Card purchases in installments that still have payments to come. Turkish banks take the whole
 * amount off the limit at purchase and bill one installment on each statement after it, so an
 * installment still to come is part of the limit already used, not new spending.
 *
 * Estimate: one installment per calendar month from the purchase month on; the last one absorbs
 * the rounding. The bank's statement is what counts.
 */
export interface InstallmentPlans {
  /** Plans with at least one installment left this month or later. */
  plans: number
  /** Sum of this month's installments across those plans. */
  monthly: Kurus
  /** Sum of everything still to be billed, this month included. */
  remaining: Kurus
}

export function installmentPlans(expenses: Expense[], accounts: Account[], today: Date): InstallmentPlans {
  const cards = new Set(accounts.filter((a) => a.kind === 'card').map((a) => a.id))
  const out: InstallmentPlans = { plans: 0, monthly: 0, remaining: 0 }
  const thisMonth = today.getFullYear() * 12 + today.getMonth()
  for (const e of expenses) {
    if (e.installments <= 1 || e.amount <= 0 || !cards.has(e.accountId)) continue
    const [y, m] = e.date.split('-').map(Number)
    const index = thisMonth - (y * 12 + m - 1) // 0 = this month is the first installment
    if (index < 0 || index >= e.installments) continue
    const each = Math.floor(e.amount / e.installments)
    const last = e.amount - each * (e.installments - 1)
    const left = e.installments - index
    out.plans++
    out.monthly += index === e.installments - 1 ? last : each
    out.remaining += each * (left - 1) + last
  }
  return out
}
