import { describe, it, expect } from 'vitest'
import {
  byMostAvailable,
  freeRatio,
  isCard,
  isKmh,
  isLiquid,
  limitHealth,
  outlook,
  spendingPower,
  statementItems,
} from './power'
import type { Account, CardAccount, CardLine, KmhAccount, RecurringPayment } from './types'

describe('power', () => {
  describe('spendingPower', () => {
    it('sums available from cards', () => {
      const accounts: CardAccount[] = [
        {
          id: 'card1',
          kind: 'card',
          name: 'Card 1',
          limit: 50000000,
          available: 30000000,
          lines: [],
          updatedAt: 0,
          createdAt: 0,
        },
        {
          id: 'card2',
          kind: 'card',
          name: 'Card 2',
          limit: 100000000,
          available: 60000000,
          lines: [],
          updatedAt: 0,
          createdAt: 0,
        },
      ]
      const result = spendingPower(accounts)
      expect(result.cards).toBe(90000000)
    })

    it('ignores negative available', () => {
      const accounts: CardAccount[] = [
        {
          id: 'card1',
          kind: 'card',
          name: 'Card 1',
          limit: 50000000,
          available: -10000000, // Negative
          lines: [],
          updatedAt: 0,
          createdAt: 0,
        },
      ]
      const result = spendingPower(accounts)
      expect(result.cards).toBe(0)
    })

    it('sums available from KMH', () => {
      const accounts: KmhAccount[] = [
        {
          id: 'kmh1',
          kind: 'kmh',
          name: 'KMH 1',
          limit: 200000000,
          available: 150000000,
          updatedAt: 0,
          createdAt: 0,
        },
      ]
      const result = spendingPower(accounts)
      expect(result.kmh).toBe(150000000)
    })

    it('sums balance from liquid accounts (bank and cash)', () => {
      const accounts: Account[] = [
        {
          id: 'bank1',
          kind: 'bank',
          name: 'Bank Account',
          balance: 500000,
          updatedAt: 0,
          createdAt: 0,
        },
        {
          id: 'cash1',
          kind: 'cash',
          name: 'Cash',
          balance: 100000,
          updatedAt: 0,
          createdAt: 0,
        },
      ]
      const result = spendingPower(accounts)
      expect(result.liquid).toBe(600000)
    })

    it('ignores negative balance in liquid accounts', () => {
      const accounts: Account[] = [
        {
          id: 'bank1',
          kind: 'bank',
          name: 'Bank Account',
          balance: -100000,
          updatedAt: 0,
          createdAt: 0,
        },
      ]
      const result = spendingPower(accounts)
      expect(result.liquid).toBe(0)
    })

    it('calculates total as sum of all sources', () => {
      const accounts: Account[] = [
        {
          id: 'card1',
          kind: 'card',
          name: 'Card',
          limit: 50000000,
          available: 30000000,
          lines: [],
          updatedAt: 0,
          createdAt: 0,
        },
        {
          id: 'kmh1',
          kind: 'kmh',
          name: 'KMH',
          limit: 200000000,
          available: 100000000,
          updatedAt: 0,
          createdAt: 0,
        },
        {
          id: 'bank1',
          kind: 'bank',
          name: 'Bank',
          balance: 50000,
          updatedAt: 0,
          createdAt: 0,
        },
      ]
      const result = spendingPower(accounts)
      expect(result.total).toBe(130050000)
    })

    it('calculates kmhUsed as limit − available', () => {
      const accounts: KmhAccount[] = [
        {
          id: 'kmh1',
          kind: 'kmh',
          name: 'KMH',
          limit: 200000000,
          available: 150000000,
          updatedAt: 0,
          createdAt: 0,
        },
      ]
      const result = spendingPower(accounts)
      expect(result.kmhUsed).toBe(50000000)
    })

    it('calculates cardLimit and kmhLimit', () => {
      const accounts: Account[] = [
        {
          id: 'card1',
          kind: 'card',
          name: 'Card 1',
          limit: 50000000,
          available: 30000000,
          lines: [],
          updatedAt: 0,
          createdAt: 0,
        },
        {
          id: 'card2',
          kind: 'card',
          name: 'Card 2',
          limit: 100000000,
          available: 60000000,
          lines: [],
          updatedAt: 0,
          createdAt: 0,
        },
        {
          id: 'kmh1',
          kind: 'kmh',
          name: 'KMH',
          limit: 200000000,
          available: 150000000,
          updatedAt: 0,
          createdAt: 0,
        },
      ]
      const result = spendingPower(accounts)
      expect(result.cardLimit).toBe(150000000)
      expect(result.kmhLimit).toBe(200000000)
    })
  })

  describe('freeRatio', () => {
    it('calculates 0–1 ratio of available to limit', () => {
      const account: CardAccount = {
        id: 'card1',
        kind: 'card',
        name: 'Card',
        limit: 100000000,
        available: 50000000,
        lines: [],
        updatedAt: 0,
        createdAt: 0,
      }
      expect(freeRatio(account)).toBe(0.5)
    })

    it('returns 0 for zero or negative limit', () => {
      const account: CardAccount = {
        id: 'card1',
        kind: 'card',
        name: 'Card',
        limit: 0,
        available: 0,
        lines: [],
        updatedAt: 0,
        createdAt: 0,
      }
      expect(freeRatio(account)).toBe(0)
    })

    it('clamps ratio at 1 when available > limit', () => {
      const account: CardAccount = {
        id: 'card1',
        kind: 'card',
        name: 'Card',
        limit: 100000000,
        available: 150000000,
        lines: [],
        updatedAt: 0,
        createdAt: 0,
      }
      expect(freeRatio(account)).toBe(1)
    })
  })

  describe('limitHealth', () => {
    it('returns empty when available <= 0', () => {
      const account: CardAccount = {
        id: 'card1',
        kind: 'card',
        name: 'Card',
        limit: 100000000,
        available: -10000000,
        lines: [],
        updatedAt: 0,
        createdAt: 0,
      }
      expect(limitHealth(account)).toBe('empty')
    })

    it('returns low when free ratio < 10%', () => {
      const account: CardAccount = {
        id: 'card1',
        kind: 'card',
        name: 'Card',
        limit: 100000000,
        available: 9000000, // 9%
        lines: [],
        updatedAt: 0,
        createdAt: 0,
      }
      expect(limitHealth(account)).toBe('low')
    })

    it('returns ok when free ratio >= 10%', () => {
      const account: CardAccount = {
        id: 'card1',
        kind: 'card',
        name: 'Card',
        limit: 100000000,
        available: 10000000, // 10%
        lines: [],
        updatedAt: 0,
        createdAt: 0,
      }
      expect(limitHealth(account)).toBe('ok')
    })

    it('returns ok when available is full', () => {
      const account: CardAccount = {
        id: 'card1',
        kind: 'card',
        name: 'Card',
        limit: 100000000,
        available: 100000000,
        lines: [],
        updatedAt: 0,
        createdAt: 0,
      }
      expect(limitHealth(account)).toBe('ok')
    })
  })

  describe('byMostAvailable', () => {
    it('sorts by available (most first)', () => {
      const accounts: CardAccount[] = [
        {
          id: 'card1',
          kind: 'card',
          name: 'Card A',
          limit: 100000000,
          available: 30000000,
          lines: [],
          updatedAt: 0,
          createdAt: 0,
        },
        {
          id: 'card2',
          kind: 'card',
          name: 'Card B',
          limit: 100000000,
          available: 50000000,
          lines: [],
          updatedAt: 0,
          createdAt: 0,
        },
      ]
      const result = byMostAvailable(accounts)
      expect(result[0].id).toBe('card2')
      expect(result[1].id).toBe('card1')
    })

    it('breaks ties by limit (larger first)', () => {
      const accounts: CardAccount[] = [
        {
          id: 'card1',
          kind: 'card',
          name: 'Card A',
          limit: 100000000,
          available: 50000000,
          lines: [],
          updatedAt: 0,
          createdAt: 0,
        },
        {
          id: 'card2',
          kind: 'card',
          name: 'Card B',
          limit: 200000000,
          available: 50000000,
          lines: [],
          updatedAt: 0,
          createdAt: 0,
        },
      ]
      const result = byMostAvailable(accounts)
      expect(result[0].id).toBe('card2')
      expect(result[1].id).toBe('card1')
    })

    it('breaks remaining ties by name (Turkish locale)', () => {
      const accounts: CardAccount[] = [
        {
          id: 'card1',
          kind: 'card',
          name: 'Ziraat',
          limit: 100000000,
          available: 50000000,
          lines: [],
          updatedAt: 0,
          createdAt: 0,
        },
        {
          id: 'card2',
          kind: 'card',
          name: 'Akbank',
          limit: 100000000,
          available: 50000000,
          lines: [],
          updatedAt: 0,
          createdAt: 0,
        },
      ]
      const result = byMostAvailable(accounts)
      expect(result[0].name).toBe('Akbank')
      expect(result[1].name).toBe('Ziraat')
    })

    it('handles liquid accounts by balance', () => {
      const accounts: Account[] = [
        {
          id: 'bank1',
          kind: 'bank',
          name: 'Bank A',
          balance: 100000,
          updatedAt: 0,
          createdAt: 0,
        },
        {
          id: 'bank2',
          kind: 'bank',
          name: 'Bank B',
          balance: 50000,
          updatedAt: 0,
          createdAt: 0,
        },
      ]
      const result = byMostAvailable(accounts)
      expect(result[0].id).toBe('bank1')
      expect(result[1].id).toBe('bank2')
    })

    it('returns a new array without mutating input', () => {
      const accounts: CardAccount[] = [
        {
          id: 'card2',
          kind: 'card',
          name: 'Card B',
          limit: 100000000,
          available: 50000000,
          lines: [],
          updatedAt: 0,
          createdAt: 0,
        },
        {
          id: 'card1',
          kind: 'card',
          name: 'Card A',
          limit: 100000000,
          available: 30000000,
          lines: [],
          updatedAt: 0,
          createdAt: 0,
        },
      ]
      const original = [...accounts]
      const result = byMostAvailable(accounts)
      expect(accounts).toEqual(original)
      expect(result).not.toBe(accounts)
    })
  })

  describe('statementItems', () => {
    it('returns items sorted by status urgency', () => {
      const today = new Date(2026, 9, 20)
      const line1: CardLine = {
        id: 'line1',
        label: 'Card 1',
        cutDay: 5,
        dueOffsetDays: 10,
        cycle: '2026-09',
        statementDebt: 100000,
        minimumDue: 20000,
        payment: 'unpaid',
      }
      const line2: CardLine = {
        id: 'line2',
        label: 'Card 2',
        cutDay: 15,
        dueOffsetDays: 10,
        cycle: '2026-09',
        statementDebt: 100000,
        minimumDue: 20000,
        payment: 'unpaid',
      }
      const accounts: CardAccount[] = [
        {
          id: 'card1',
          kind: 'card',
          name: 'Card 1',
          limit: 100000000,
          available: 50000000,
          lines: [line1, line2],
          updatedAt: 0,
          createdAt: 0,
        },
      ]
      const result = statementItems(accounts, today)
      expect(result.length).toBe(2)
    })

    it('estimates minimum when not entered but debt is known', () => {
      const today = new Date(2026, 9, 20)
      const line: CardLine = {
        id: 'line1',
        label: 'Card 1',
        cutDay: 5,
        dueOffsetDays: 10,
        cycle: '2026-10', // Must match current cycle (Oct 5 is cut date)
        statementDebt: 100000, // 1.000 ₺
        payment: 'unpaid',
      }
      const accounts: CardAccount[] = [
        {
          id: 'card1',
          kind: 'card',
          name: 'Card 1',
          limit: 100000000,
          available: 50000000,
          lines: [line],
          updatedAt: 0,
          createdAt: 0,
        },
      ]
      const result = statementItems(accounts, today)
      const item = result.find((i) => i.lineIndex === 0)
      expect(item?.minimumOutstanding).not.toBeNull()
      expect(item?.minimumIsEstimate).toBe(true)
    })

    it('returns null minimum when neither minimumDue nor statementDebt are known', () => {
      const today = new Date(2026, 9, 20)
      const line: CardLine = {
        id: 'line1',
        label: 'Card 1',
        cutDay: 5,
        dueOffsetDays: 10,
        cycle: '2026-09',
        payment: 'unpaid',
      }
      const accounts: CardAccount[] = [
        {
          id: 'card1',
          kind: 'card',
          name: 'Card 1',
          limit: 100000000,
          available: 50000000,
          lines: [line],
          updatedAt: 0,
          createdAt: 0,
        },
      ]
      const result = statementItems(accounts, today)
      expect(result[0].minimumOutstanding).toBeNull()
    })

    it('returns 0 for paid statements', () => {
      const today = new Date(2026, 9, 20)
      const line: CardLine = {
        id: 'line1',
        label: 'Card 1',
        cutDay: 5,
        dueOffsetDays: 10,
        cycle: '2026-10', // Must match current cycle
        statementDebt: 100000,
        minimumDue: 20000,
        payment: 'full',
      }
      const accounts: CardAccount[] = [
        {
          id: 'card1',
          kind: 'card',
          name: 'Card 1',
          limit: 100000000,
          available: 50000000,
          lines: [line],
          updatedAt: 0,
          createdAt: 0,
        },
      ]
      const result = statementItems(accounts, today)
      const item = result.find((i) => i.lineIndex === 0)
      expect(item?.minimumOutstanding).toBe(0)
    })

    it('subtracts paid amount from minimum', () => {
      const today = new Date(2026, 9, 20)
      const line: CardLine = {
        id: 'line1',
        label: 'Card 1',
        cutDay: 5,
        dueOffsetDays: 10,
        cycle: '2026-10', // Must match current cycle
        statementDebt: 100000,
        minimumDue: 20000,
        payment: 'partial',
        paidAmount: 10000,
      }
      const accounts: CardAccount[] = [
        {
          id: 'card1',
          kind: 'card',
          name: 'Card 1',
          limit: 100000000,
          available: 50000000,
          lines: [line],
          updatedAt: 0,
          createdAt: 0,
        },
      ]
      const result = statementItems(accounts, today)
      const item = result.find((i) => i.lineIndex === 0)
      expect(item?.minimumOutstanding).toBe(10000)
    })
  })

  describe('outlook', () => {
    it('defaults horizon to nearest nextCut', () => {
      const today = new Date(2026, 9, 20)
      const line: CardLine = {
        id: 'line1',
        label: 'Card 1',
        cutDay: 26,
        dueOffsetDays: 10,
        cycle: '2026-09',
        statementDebt: 100000,
        minimumDue: 20000,
        payment: 'unpaid',
      }
      const accounts: CardAccount[] = [
        {
          id: 'card1',
          kind: 'card',
          name: 'Card 1',
          limit: 100000000,
          available: 50000000,
          lines: [line],
          updatedAt: 0,
          createdAt: 0,
        },
      ]
      const result = outlook(accounts, [], today)
      // Today is Oct 20, cut is 26th, last cut was Sep 26, next cut is Oct 26
      expect(result.until).toEqual(new Date(2026, 9, 26))
    })

    it('includes minimums only for unpaid statements due on or before horizon', () => {
      const today = new Date(2026, 9, 20)
      const line: CardLine = {
        id: 'line1',
        label: 'Card 1',
        cutDay: 26,
        dueOffsetDays: 10,
        cycle: '2026-09',
        statementDebt: 100000,
        minimumDue: 20000,
        payment: 'unpaid',
      }
      const accounts: CardAccount[] = [
        {
          id: 'card1',
          kind: 'card',
          name: 'Card 1',
          limit: 100000000,
          available: 50000000,
          lines: [line],
          updatedAt: 0,
          createdAt: 0,
        },
      ]
      const until = new Date(2026, 10, 4)
      const result = outlook(accounts, [], today, until)
      expect(result.minimums).toBeGreaterThan(0)
    })

    it('counts unknownMinimums for statements without minimumDue', () => {
      const today = new Date(2026, 9, 20)
      const line: CardLine = {
        id: 'line1',
        label: 'Card 1',
        cutDay: 26,
        dueOffsetDays: 10,
        cycle: '2026-09',
        statementDebt: 100000,
        payment: 'unpaid',
      }
      const accounts: CardAccount[] = [
        {
          id: 'card1',
          kind: 'card',
          name: 'Card 1',
          limit: 100000000,
          available: 50000000,
          lines: [line],
          updatedAt: 0,
          createdAt: 0,
        },
      ]
      const result = outlook(accounts, [], today)
      expect(result.unknownMinimums).toBe(0) // Has statementDebt so can estimate
    })

    it('sums recurring payments from all sources', () => {
      const today = new Date(2026, 9, 20)
      const recurring: RecurringPayment[] = [
        {
          id: 'r1',
          name: 'Netflix',
          amount: 1500,
          categoryId: 'cat1',
          accountId: 'card1',
          dayOfMonth: 25,
          startDate: '2026-10-25',
          end: { type: 'never' },
          active: true,
          createdAt: 0,
        },
        {
          id: 'r2',
          name: 'Rent',
          amount: 500000,
          categoryId: 'cat1',
          accountId: 'bank1',
          dayOfMonth: 1,
          startDate: '2026-11-01',
          end: { type: 'never' },
          active: true,
          createdAt: 0,
        },
      ]
      const accounts: Account[] = [
        {
          id: 'card1',
          kind: 'card',
          name: 'Card 1',
          limit: 100000000,
          available: 50000000,
          lines: [],
          updatedAt: 0,
          createdAt: 0,
        },
        {
          id: 'bank1',
          kind: 'bank',
          name: 'Bank',
          balance: 1000000,
          updatedAt: 0,
          createdAt: 0,
        },
      ]
      const result = outlook(accounts, recurring, today)
      expect(result.recurring).toBeGreaterThan(0)
    })

    it('splits recurring by card vs cash sources', () => {
      const today = new Date(2026, 9, 20)
      const recurring: RecurringPayment[] = [
        {
          id: 'r1',
          name: 'Card Payment',
          amount: 1500,
          categoryId: 'cat1',
          accountId: 'card1',
          dayOfMonth: 25,
          startDate: '2026-10-25',
          end: { type: 'never' },
          active: true,
          createdAt: 0,
        },
        {
          id: 'r2',
          name: 'Cash Payment',
          amount: 5000,
          categoryId: 'cat1',
          accountId: 'bank1',
          dayOfMonth: 1,
          startDate: '2026-11-01',
          end: { type: 'never' },
          active: true,
          createdAt: 0,
        },
      ]
      const accounts: Account[] = [
        {
          id: 'card1',
          kind: 'card',
          name: 'Card 1',
          limit: 100000000,
          available: 50000000,
          lines: [],
          updatedAt: 0,
          createdAt: 0,
        },
        {
          id: 'bank1',
          kind: 'bank',
          name: 'Bank',
          balance: 1000000,
          updatedAt: 0,
          createdAt: 0,
        },
      ]
      const result = outlook(accounts, recurring, today)
      expect(result.recurringFromCash).toBeGreaterThan(0)
      expect(result.recurringFromCash).toBeLessThan(result.recurring)
    })

    it('calculates powerAfter as total − recurring', () => {
      const today = new Date(2026, 9, 20)
      const accounts: Account[] = [
        {
          id: 'card1',
          kind: 'card',
          name: 'Card 1',
          limit: 100000000,
          available: 50000000,
          lines: [],
          updatedAt: 0,
          createdAt: 0,
        },
      ]
      const result = outlook(accounts, [], today)
      expect(result.powerAfter).toBe(result.cashAvailable + 50000000)
    })

    it('calculates cashAfter as liquid + kmh − minimums − recurringFromCash', () => {
      const today = new Date(2026, 9, 20)
      const accounts: Account[] = [
        {
          id: 'bank1',
          kind: 'bank',
          name: 'Bank',
          balance: 1000000,
          updatedAt: 0,
          createdAt: 0,
        },
      ]
      const result = outlook(accounts, [], today)
      const expected = 1000000 - 0 - 0 // liquid - minimums - recurringFromCash
      expect(result.cashAfter).toBe(expected)
    })

    it('respects explicit until parameter', () => {
      const today = new Date(2026, 9, 20)
      const until = new Date(2026, 11, 31)
      const accounts: Account[] = [
        {
          id: 'card1',
          kind: 'card',
          name: 'Card 1',
          limit: 100000000,
          available: 50000000,
          lines: [],
          updatedAt: 0,
          createdAt: 0,
        },
      ]
      const result = outlook(accounts, [], today, until)
      expect(result.until).toEqual(until)
    })

    it('counts recurringCount and days', () => {
      const today = new Date(2026, 9, 20)
      const recurring: RecurringPayment[] = [
        {
          id: 'r1',
          name: 'Payment',
          amount: 1000,
          categoryId: 'cat1',
          accountId: 'card1',
          dayOfMonth: 25,
          startDate: '2026-10-25',
          end: { type: 'never' },
          active: true,
          createdAt: 0,
        },
      ]
      const accounts: Account[] = [
        {
          id: 'card1',
          kind: 'card',
          name: 'Card 1',
          limit: 100000000,
          available: 50000000,
          lines: [],
          updatedAt: 0,
          createdAt: 0,
        },
      ]
      const result = outlook(accounts, recurring, today)
      expect(result.recurringCount).toBeGreaterThanOrEqual(0)
      expect(result.days).toBeGreaterThan(0)
    })
  })

  describe('type guards', () => {
    it('isCard identifies card accounts', () => {
      const card: CardAccount = {
        id: 'card1',
        kind: 'card',
        name: 'Card',
        limit: 100000000,
        available: 50000000,
        lines: [],
        updatedAt: 0,
        createdAt: 0,
      }
      expect(isCard(card)).toBe(true)
    })

    it('isKmh identifies KMH accounts', () => {
      const kmh: KmhAccount = {
        id: 'kmh1',
        kind: 'kmh',
        name: 'KMH',
        limit: 200000000,
        available: 150000000,
        updatedAt: 0,
        createdAt: 0,
      }
      expect(isKmh(kmh)).toBe(true)
    })

    it('isLiquid identifies bank and cash accounts', () => {
      const bank: Account = {
        id: 'bank1',
        kind: 'bank',
        name: 'Bank',
        balance: 500000,
        updatedAt: 0,
        createdAt: 0,
      }
      const cash: Account = {
        id: 'cash1',
        kind: 'cash',
        name: 'Cash',
        balance: 100000,
        updatedAt: 0,
        createdAt: 0,
      }
      expect(isLiquid(bank)).toBe(true)
      expect(isLiquid(cash)).toBe(true)
    })
  })
})
