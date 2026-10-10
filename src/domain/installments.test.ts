import { describe, expect, it } from 'vitest'
import { installmentPlans } from './installments'
import type { Account, Expense } from './types'

const card = { id: 'k', kind: 'card' } as Account
const bank = { id: 'b', kind: 'bank' } as Account
const exp = (over: Partial<Expense>): Expense => ({
  id: 'e',
  amount: 120_000,
  categoryId: 'c',
  accountId: 'k',
  date: '2026-10-04',
  note: '',
  affectsAccount: true,
  installments: 12,
  source: 'manual',
  createdAt: 0,
  ...over,
})
const today = new Date(2026, 9, 10)

describe('installmentPlans', () => {
  it.each([
    // purchase date, installments, amount, plans, monthly, remaining
    ['2026-10-04', 12, 120_000, 1, 10_000, 120_000], // first installment this month
    ['2026-08-15', 3, 100_000, 1, 33_334, 33_334], // last of three: takes the rounding
    ['2026-09-30', 3, 100_000, 1, 33_333, 66_667],
    ['2026-07-01', 3, 90_000, 0, 0, 0], // finished
    ['2025-12-31', 12, 120_000, 1, 10_000, 20_000], // across the year boundary: 11th of 12
    ['2026-11-01', 6, 60_000, 0, 0, 0], // future-dated
    ['2026-10-04', 1, 50_000, 0, 0, 0], // single payment
  ])('%s, %i × %i kuruş', (date, installments, amount, plans, monthly, remaining) => {
    expect(installmentPlans([exp({ date, installments, amount })], [card], today)).toEqual({ plans, monthly, remaining })
  })

  it('counts card purchases only and adds plans up', () => {
    const list = [exp({ id: 'a' }), exp({ id: 'b', amount: 60_000, installments: 6 }), exp({ id: 'c', accountId: 'b' })]
    expect(installmentPlans(list, [card, bank], today)).toEqual({ plans: 2, monthly: 20_000, remaining: 180_000 })
  })

  it('never loses a kuruş over a whole plan', () => {
    for (const amount of [1, 7, 99_999, 123_457]) {
      let billed = 0
      for (let month = 0; month < 9; month++) {
        billed += installmentPlans([exp({ amount, installments: 9, date: '2026-01-05' })], [card], new Date(2026, month, 10)).monthly
      }
      expect(billed).toBe(amount)
    }
  })
})
