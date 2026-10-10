import type { Account } from '../domain/types'

/** Stable wallet colour slot (1–7) per account: by creation order, so it never jumps when balances change. */
export function accountColors(accounts: Account[]): Map<string, number> {
  const ordered = [...accounts].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
  return new Map(ordered.map((a, i) => [a.id, (i % 7) + 1]))
}
