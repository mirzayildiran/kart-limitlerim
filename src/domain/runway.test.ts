import { describe, it, expect } from 'vitest'
import { outlook } from './power'
import { runway } from './runway'
import type { Account, CardAccount, RecurringPayment } from './types'

const today = new Date(2026, 9, 10)

const card: CardAccount = {
  id: 'c1',
  kind: 'card',
  name: 'Kart A',
  limit: 5_000_000,
  available: 3_000_000,
  lines: [
    {
      id: 'l1',
      label: 'Ana',
      cutDay: 18,
      dueOffsetDays: 10,
      cycle: '2026-09',
      statementDebt: 1_000_000,
      minimumDue: 200_000,
      dueDate: '2026-10-13',
      payment: 'unpaid',
    },
  ],
  updatedAt: 0,
  createdAt: 0,
}

const cash: Account = { id: 'b1', kind: 'bank', name: 'Banka', balance: 500_000, updatedAt: 0, createdAt: 0 }

const rent: RecurringPayment = {
  id: 'r1',
  name: 'Kira',
  amount: 400_000,
  categoryId: 'kira',
  accountId: 'b1',
  dayOfMonth: 15,
  startDate: '2026-01-01',
  end: { type: 'never' },
  active: true,
  createdAt: 0,
}

describe('runway', () => {
  const days = runway([card, cash], [rent], today)

  it('runs from today to the next statement cut', () => {
    expect(days[0].date).toEqual(today)
    expect(days.at(-1)?.date).toEqual(new Date(2026, 9, 18))
    expect(days).toHaveLength(9)
  })

  it('starts at spending power and ends where the outlook ends', () => {
    expect(days[0].power).toBe(3_500_000)
    expect(days.at(-1)?.power).toBe(outlook([card, cash], [rent], today).powerAfter)
  })

  it('drops on the day a recurring payment lands', () => {
    expect(days[4].power).toBe(3_500_000)
    expect(days[5].power).toBe(3_100_000)
    expect(days[5].events).toEqual([{ kind: 'recurring', label: 'Kira', amount: 400_000 }])
  })

  it('marks due dates and the cut without changing power', () => {
    expect(days[3].events).toEqual([{ kind: 'due', label: 'Kart A son ödeme', amount: 200_000 }])
    expect(days[3].power).toBe(days[2].power)
    expect(days[8].events).toContainEqual({ kind: 'cut', label: 'Kart A kesim', amount: null })
  })
})
