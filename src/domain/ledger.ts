import type { Account, Expense, Kurus } from './types'

/**
 * How expenses move account figures. A card purchase blocks its full amount on
 * the limit immediately, installments included, which is how Turkish banks do it.
 */

export function applyDelta(a: Account, delta: Kurus): Account {
  switch (a.kind) {
    case 'card':
    case 'kmh':
      return { ...a, available: a.available + delta }
    default:
      return { ...a, balance: a.balance + delta }
  }
}

/**
 * Account deltas needed to go from `before` to `after` for one expense record.
 * Either side may be null (create / delete). Returns accountId → delta.
 */
export function expenseDeltas(before: Expense | null, after: Expense | null): Map<string, Kurus> {
  const deltas = new Map<string, Kurus>()
  const add = (id: string, d: Kurus) => deltas.set(id, (deltas.get(id) ?? 0) + d)
  if (before?.affectsAccount) add(before.accountId, before.amount)
  if (after?.affectsAccount) add(after.accountId, -after.amount)
  for (const [id, d] of deltas) if (d === 0) deltas.delete(id)
  return deltas
}

/** Read the account's spendable figure regardless of kind. */
export function freeAmount(a: Account): Kurus {
  switch (a.kind) {
    case 'card':
    case 'kmh':
      return a.available
    default:
      return a.balance
  }
}
