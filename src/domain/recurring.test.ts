import { describe, it, expect } from 'vitest'
import { nextOccurrence, occurrences } from './recurring'
import type { RecurringPayment } from './types'

describe('recurring', () => {
  describe('occurrences', () => {
    it('returns empty array for inactive payment', () => {
      const payment: RecurringPayment = {
        id: 'r1',
        name: 'Netflix',
        amount: 1500,
        categoryId: 'cat1',
        accountId: 'acc1',
        dayOfMonth: 15,
        startDate: '2026-10-15',
        end: { type: 'never' },
        active: false,
        createdAt: 0,
      }
      const result = occurrences(payment, new Date(2026, 9, 1), new Date(2026, 9, 30))
      expect(result).toEqual([])
    })

    it('returns occurrences within date range', () => {
      const payment: RecurringPayment = {
        id: 'r1',
        name: 'Netflix',
        amount: 1500,
        categoryId: 'cat1',
        accountId: 'acc1',
        dayOfMonth: 15,
        startDate: '2026-09-15',
        end: { type: 'never' },
        active: true,
        createdAt: 0,
      }
      const result = occurrences(payment, new Date(2026, 9, 1), new Date(2026, 11, 31))
      expect(result).toEqual([
        new Date(2026, 9, 15), // Oct 15
        new Date(2026, 10, 15), // Nov 15
        new Date(2026, 11, 15), // Dec 15
      ])
    })

    it('skips occurrences before start date', () => {
      const payment: RecurringPayment = {
        id: 'r1',
        name: 'Netflix',
        amount: 1500,
        categoryId: 'cat1',
        accountId: 'acc1',
        dayOfMonth: 15,
        startDate: '2026-10-15',
        end: { type: 'never' },
        active: true,
        createdAt: 0,
      }
      const result = occurrences(payment, new Date(2026, 9, 1), new Date(2026, 11, 31))
      expect(result).toEqual([
        new Date(2026, 9, 15), // Oct 15
        new Date(2026, 10, 15), // Nov 15
        new Date(2026, 11, 15), // Dec 15
      ])
    })

    it('clamps dayOfMonth 31 to shorter months', () => {
      const payment: RecurringPayment = {
        id: 'r1',
        name: 'Payment',
        amount: 1000,
        categoryId: 'cat1',
        accountId: 'acc1',
        dayOfMonth: 31,
        startDate: '2026-09-30', // Sep 30 is before range start
        end: { type: 'never' },
        active: true,
        createdAt: 0,
      }
      const result = occurrences(payment, new Date(2026, 8, 1), new Date(2026, 10, 31))
      // Sep 30, Oct 31, Nov 30 (clamped)
      expect(result.length).toBe(3)
      expect(result[0]).toEqual(new Date(2026, 8, 30)) // Sep 30
      expect(result[1]).toEqual(new Date(2026, 9, 31)) // Oct 31
      expect(result[2]).toEqual(new Date(2026, 10, 30)) // Nov 30
    })

    it('respects until end date (inclusive)', () => {
      const payment: RecurringPayment = {
        id: 'r1',
        name: 'Payment',
        amount: 1000,
        categoryId: 'cat1',
        accountId: 'acc1',
        dayOfMonth: 15,
        startDate: '2026-09-15',
        end: { type: 'until', date: '2026-11-15' },
        active: true,
        createdAt: 0,
      }
      const result = occurrences(payment, new Date(2026, 8, 1), new Date(2026, 11, 31))
      expect(result).toEqual([
        new Date(2026, 8, 15), // Sep 15
        new Date(2026, 9, 15), // Oct 15
        new Date(2026, 10, 15), // Nov 15 (inclusive)
      ])
    })

    it('stops before until date when payment would occur after', () => {
      const payment: RecurringPayment = {
        id: 'r1',
        name: 'Payment',
        amount: 1000,
        categoryId: 'cat1',
        accountId: 'acc1',
        dayOfMonth: 15,
        startDate: '2026-09-15',
        end: { type: 'until', date: '2026-11-14' },
        active: true,
        createdAt: 0,
      }
      const result = occurrences(payment, new Date(2026, 8, 1), new Date(2026, 11, 31))
      expect(result).toEqual([
        new Date(2026, 8, 15), // Sep 15
        new Date(2026, 9, 15), // Oct 15
      ])
    })

    it('counts from startDate even when from is later', () => {
      const payment: RecurringPayment = {
        id: 'r1',
        name: 'Payment',
        amount: 1000,
        categoryId: 'cat1',
        accountId: 'acc1',
        dayOfMonth: 15,
        startDate: '2026-08-15',
        end: { type: 'count', count: 3 },
        active: true,
        createdAt: 0,
      }
      // Range from Oct 1 to Nov 30
      const result = occurrences(payment, new Date(2026, 9, 1), new Date(2026, 10, 30))
      // Payments are Aug 15 (1st), Sep 15 (2nd), Oct 15 (3rd)
      // Only Oct 15 falls in [Oct 1, Nov 30] (Sep 15 is excluded by 'from')
      expect(result).toEqual([
        new Date(2026, 9, 15), // Oct 15 (3rd occurrence)
      ])
    })

    it('respects count end without from constraint', () => {
      const payment: RecurringPayment = {
        id: 'r1',
        name: 'Payment',
        amount: 1000,
        categoryId: 'cat1',
        accountId: 'acc1',
        dayOfMonth: 15,
        startDate: '2026-09-15',
        end: { type: 'count', count: 2 },
        active: true,
        createdAt: 0,
      }
      const result = occurrences(payment, new Date(2026, 8, 1), new Date(2026, 11, 31))
      expect(result).toEqual([
        new Date(2026, 8, 15), // Sep 15
        new Date(2026, 9, 15), // Oct 15
      ])
    })

    it('returns empty when to < from', () => {
      const payment: RecurringPayment = {
        id: 'r1',
        name: 'Payment',
        amount: 1000,
        categoryId: 'cat1',
        accountId: 'acc1',
        dayOfMonth: 15,
        startDate: '2026-09-15',
        end: { type: 'never' },
        active: true,
        createdAt: 0,
      }
      const result = occurrences(payment, new Date(2026, 10, 31), new Date(2026, 9, 1))
      expect(result).toEqual([])
    })

    it('handles February leap year boundary', () => {
      // 2028 is a leap year, Feb has 29 days
      const payment: RecurringPayment = {
        id: 'r1',
        name: 'Payment',
        amount: 1000,
        categoryId: 'cat1',
        accountId: 'acc1',
        dayOfMonth: 29,
        startDate: '2028-01-29',
        end: { type: 'never' },
        active: true,
        createdAt: 0,
      }
      // From Jan 1 to Mar 31 gives Jan 29, Feb 29, Mar 29
      const result = occurrences(payment, new Date(2028, 0, 1), new Date(2028, 2, 31))
      expect(result.length).toBe(3)
      expect(result[0]).toEqual(new Date(2028, 0, 29)) // Jan 29
      expect(result[1]).toEqual(new Date(2028, 1, 29)) // Feb 29 (leap year)
      expect(result[2]).toEqual(new Date(2028, 2, 29)) // Mar 29
    })

    it('clamps Feb 31 to 28 in non-leap year', () => {
      const payment: RecurringPayment = {
        id: 'r1',
        name: 'Payment',
        amount: 1000,
        categoryId: 'cat1',
        accountId: 'acc1',
        dayOfMonth: 31,
        startDate: '2026-01-31',
        end: { type: 'never' },
        active: true,
        createdAt: 0,
      }
      const result = occurrences(payment, new Date(2026, 0, 1), new Date(2026, 2, 31))
      expect(result).toEqual([
        new Date(2026, 0, 31), // Jan 31
        new Date(2026, 1, 28), // Feb 28 (non-leap year)
        new Date(2026, 2, 31), // Mar 31
      ])
    })
  })

  describe('nextOccurrence', () => {
    it('returns the next occurrence from today', () => {
      const payment: RecurringPayment = {
        id: 'r1',
        name: 'Netflix',
        amount: 1500,
        categoryId: 'cat1',
        accountId: 'acc1',
        dayOfMonth: 15,
        startDate: '2026-10-15',
        end: { type: 'never' },
        active: true,
        createdAt: 0,
      }
      const result = nextOccurrence(payment, new Date(2026, 9, 10))
      expect(result).toEqual(new Date(2026, 9, 15))
    })

    it('returns null for inactive payment', () => {
      const payment: RecurringPayment = {
        id: 'r1',
        name: 'Netflix',
        amount: 1500,
        categoryId: 'cat1',
        accountId: 'acc1',
        dayOfMonth: 15,
        startDate: '2026-10-15',
        end: { type: 'never' },
        active: false,
        createdAt: 0,
      }
      const result = nextOccurrence(payment, new Date(2026, 9, 10))
      expect(result).toBeNull()
    })

    it('returns null when payment has ended', () => {
      const payment: RecurringPayment = {
        id: 'r1',
        name: 'Netflix',
        amount: 1500,
        categoryId: 'cat1',
        accountId: 'acc1',
        dayOfMonth: 15,
        startDate: '2026-10-15',
        end: { type: 'until', date: '2026-10-15' },
        active: true,
        createdAt: 0,
      }
      const result = nextOccurrence(payment, new Date(2026, 9, 16))
      expect(result).toBeNull()
    })

    it('returns null when count is exhausted', () => {
      const payment: RecurringPayment = {
        id: 'r1',
        name: 'Payment',
        amount: 1000,
        categoryId: 'cat1',
        accountId: 'acc1',
        dayOfMonth: 15,
        startDate: '2026-10-15',
        end: { type: 'count', count: 1 },
        active: true,
        createdAt: 0,
      }
      const result = nextOccurrence(payment, new Date(2026, 9, 16))
      expect(result).toBeNull()
    })

    it('looks ahead 2 years', () => {
      const payment: RecurringPayment = {
        id: 'r1',
        name: 'Payment',
        amount: 1000,
        categoryId: 'cat1',
        accountId: 'acc1',
        dayOfMonth: 15,
        startDate: '2026-10-15',
        end: { type: 'never' },
        active: true,
        createdAt: 0,
      }
      const today = new Date(2026, 9, 10)
      const result = nextOccurrence(payment, today)
      expect(result).not.toBeNull()
      expect(result!.getFullYear()).toBeLessThanOrEqual(2028)
    })
  })
})
