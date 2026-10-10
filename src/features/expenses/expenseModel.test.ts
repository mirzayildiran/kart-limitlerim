import { describe, it, expect } from 'vitest'
import {
  expensesByMonth,
  groupExpensesByDay,
  categoryTotals,
  accountTotals,
  previewAvailable,
  validateCategoryName,
  interestNudge,
  monthNavigation,
  filterExpenses,
  dayTotal,
} from './expenseModel'
import type { Expense, CardAccount, KmhAccount, Kurus, IsoDate } from '../../domain/types'

/**
 * Tests use invented data only. No real user data.
 */

const mockExpense = (overrides: Partial<Expense> = {}): Expense => ({
  id: 'exp_test123',
  amount: 50000 as Kurus, // 500 ₺
  categoryId: 'cat_food',
  accountId: 'acc_card1',
  date: '2026-10-08' as IsoDate,
  note: 'Test expense',
  affectsAccount: true,
  installments: 1,
  source: 'manual',
  createdAt: Date.now(),
  ...overrides,
})

const mockCardAccount = (overrides: Partial<CardAccount> = {}): CardAccount => ({
  id: 'acc_card1',
  kind: 'card',
  name: 'Test Card',
  limit: 50000000 as Kurus, // 500k ₺
  available: 25000000 as Kurus, // 250k ₺
  updatedAt: Date.now(),
  createdAt: Date.now(),
  lines: [],
  ...overrides,
})

const mockKmhAccount = (overrides: Partial<KmhAccount> = {}): KmhAccount => ({
  id: 'acc_kmh1',
  kind: 'kmh',
  name: 'Test KMH',
  limit: 50000000 as Kurus, // 500k ₺
  available: 25000000 as Kurus, // 250k ₺
  updatedAt: Date.now(),
  createdAt: Date.now(),
  ...overrides,
})

describe('expenseModel', () => {
  describe('expensesByMonth', () => {
    it('filters expenses by month key', () => {
      const expenses = [
        mockExpense({ date: '2026-10-01' as IsoDate }),
        mockExpense({ date: '2026-10-15' as IsoDate }),
        mockExpense({ date: '2026-09-30' as IsoDate }),
      ]

      const october = expensesByMonth(expenses, '2026-10')
      expect(october).toHaveLength(2)
      expect(october.every((e) => e.date.startsWith('2026-10'))).toBe(true)
    })

    it('returns empty array for month with no expenses', () => {
      const expenses = [mockExpense({ date: '2026-10-01' as IsoDate })]
      const september = expensesByMonth(expenses, '2026-09')
      expect(september).toHaveLength(0)
    })
  })

  describe('groupExpensesByDay', () => {
    it('groups expenses by date and sorts by date desc', () => {
      const expenses = [
        mockExpense({ id: 'exp_1', date: '2026-10-05' as IsoDate, createdAt: 100 }),
        mockExpense({ id: 'exp_2', date: '2026-10-08' as IsoDate, createdAt: 200 }),
        mockExpense({ id: 'exp_3', date: '2026-10-08' as IsoDate, createdAt: 300 }),
      ]

      const grouped = groupExpensesByDay(expenses)
      expect(grouped).toHaveLength(2)
      expect(grouped[0].date).toBe('2026-10-08')
      expect(grouped[1].date).toBe('2026-10-05')
      expect(grouped[0].expenses).toHaveLength(2)
      expect(grouped[0].expenses[0].id).toBe('exp_3') // Most recent first
    })

    it('includes day name in Turkish', () => {
      const expenses = [mockExpense({ date: '2026-10-08' as IsoDate })]
      const grouped = groupExpensesByDay(expenses)
      expect(grouped[0].day).toContain('8')
      expect(grouped[0].day).toContain('Ekim') // October in Turkish
    })
  })

  describe('categoryTotals', () => {
    it('sums amounts by category', () => {
      const expenses = [
        mockExpense({ categoryId: 'cat_food', amount: 50000 as Kurus }),
        mockExpense({ categoryId: 'cat_food', amount: 30000 as Kurus }),
        mockExpense({ categoryId: 'cat_transport', amount: 20000 as Kurus }),
      ]

      const totals = categoryTotals(expenses)
      expect(totals.get('cat_food')).toBe(80000)
      expect(totals.get('cat_transport')).toBe(20000)
    })

    it('returns empty map for no expenses', () => {
      const totals = categoryTotals([])
      expect(totals.size).toBe(0)
    })
  })

  describe('accountTotals', () => {
    it('sums amounts by account', () => {
      const expenses = [
        mockExpense({ accountId: 'acc_1', amount: 50000 as Kurus }),
        mockExpense({ accountId: 'acc_1', amount: 30000 as Kurus }),
        mockExpense({ accountId: 'acc_2', amount: 20000 as Kurus }),
      ]

      const totals = accountTotals(expenses)
      expect(totals.get('acc_1')).toBe(80000)
      expect(totals.get('acc_2')).toBe(20000)
    })
  })

  describe('previewAvailable', () => {
    const account = mockCardAccount()

    it('reduces available when creating an expense', () => {
      const newExpense = mockExpense({ amount: 100000 as Kurus, affectsAccount: true })
      const result = previewAvailable(null, newExpense, account, 25000000)
      expect(result).toBe(25000000 - 100000)
    })

    it('restores old amount and applies new when editing same account', () => {
      const oldExpense = mockExpense({ accountId: 'acc_card1', amount: 50000 as Kurus, affectsAccount: true })
      const newExpense = mockExpense({ amount: 100000 as Kurus, affectsAccount: true })
      const result = previewAvailable(oldExpense, newExpense, account, 25000000)
      expect(result).toBe(25000000 + 50000 - 100000)
    })

    it('ignores old expense from different account', () => {
      const oldExpense = mockExpense({ accountId: 'acc_other', amount: 50000 as Kurus, affectsAccount: true })
      const newExpense = mockExpense({ accountId: 'acc_card1', amount: 100000 as Kurus, affectsAccount: true })
      const result = previewAvailable(oldExpense, newExpense, account, 25000000)
      expect(result).toBe(25000000 - 100000)
    })

    it('ignores expenses that do not affect account', () => {
      const newExpense = mockExpense({ amount: 100000 as Kurus, affectsAccount: false })
      const result = previewAvailable(null, newExpense, account, 25000000)
      expect(result).toBe(25000000)
    })
  })

  describe('validateCategoryName', () => {
    it('accepts valid new names', () => {
      const result = validateCategoryName('Yemek', ['Transport', 'Ev'])
      expect(result).toEqual({ valid: true })
    })

    it('rejects empty names', () => {
      const result = validateCategoryName('  ', ['Transport'])
      expect(result.valid).toBe(false)
      expect(result.valid === false && result.error).toContain('boş')
    })

    it('rejects names longer than 24 characters', () => {
      const long = 'a'.repeat(25)
      const result = validateCategoryName(long, [])
      expect(result.valid).toBe(false)
      expect(result.valid === false && result.error).toContain('24 karakter')
    })

    it('rejects duplicate names (case-insensitive)', () => {
      const result = validateCategoryName('yemek', ['Transport', 'Yemek'])
      expect(result.valid).toBe(false)
      expect(result.valid === false && result.error).toContain('zaten var')
    })

    it('rejects duplicates with different case', () => {
      const result = validateCategoryName('YEMEK', ['yemek'])
      expect(result.valid).toBe(false)
    })
  })

  describe('interestNudge', () => {
    it('returns null for zero or negative amounts', () => {
      const account = mockCardAccount()
      expect(interestNudge(account, 0)).toBeNull()
      expect(interestNudge(account, -1000)).toBeNull()
    })

    it('returns interest text for positive card amounts', () => {
      const account = mockCardAccount()
      const text = interestNudge(account, 100000) // 1000 ₺
      expect(text).not.toBeNull()
      expect(text).toContain('faiz')
    })

    it('uses rate override when present on card', () => {
      const account = mockCardAccount({
        rateOverride: { contractual: 5, late: 6 },
      })
      const text = interestNudge(account, 100000)
      expect(text).toBeTruthy()
    })

    it('returns interest text for positive KMH amounts', () => {
      const account = mockKmhAccount()
      const text = interestNudge(account, 100000) // 1000 ₺
      expect(text).not.toBeNull()
      expect(text).toContain('faiz')
    })

    it('uses rate override when present on KMH', () => {
      const account = mockKmhAccount({
        rateOverride: { contractual: 5, late: 6 },
      })
      const text = interestNudge(account, 100000)
      expect(text).toBeTruthy()
    })
  })

  describe('monthNavigation', () => {
    it('returns previous month and next month', () => {
      const nav = monthNavigation('2026-09')
      expect(nav.prev).toBe('2026-08')
      expect(nav.next).toBe('2026-10')
    })

    it('returns null for next when current month', () => {
      const today = new Date()
      const currentKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
      const nav = monthNavigation(currentKey)
      expect(nav.next).toBeNull()
    })
  })
  describe('filterExpenses', () => {
    const list = [
      mockExpense({ id: 'a', categoryId: 'cat_food', accountId: 'acc_1' }),
      mockExpense({ id: 'b', categoryId: 'cat_food', accountId: 'acc_2' }),
      mockExpense({ id: 'c', categoryId: 'cat_fun', accountId: 'acc_1' }),
    ]

    it('returns every expense when no filter is given', () => {
      expect(filterExpenses(list).map((e) => e.id)).toEqual(['a', 'b', 'c'])
      expect(filterExpenses(list, {}).map((e) => e.id)).toEqual(['a', 'b', 'c'])
    })

    it('filters by category', () => {
      expect(filterExpenses(list, { categoryId: 'cat_food' }).map((e) => e.id)).toEqual(['a', 'b'])
    })

    it('filters by account', () => {
      expect(filterExpenses(list, { accountId: 'acc_1' }).map((e) => e.id)).toEqual(['a', 'c'])
    })

    it('combines category and account with AND', () => {
      expect(filterExpenses(list, { categoryId: 'cat_food', accountId: 'acc_1' }).map((e) => e.id)).toEqual(['a'])
    })

    it('returns an empty list when nothing matches', () => {
      expect(filterExpenses(list, { categoryId: 'cat_missing' })).toEqual([])
    })

    it('does not mutate the input', () => {
      const copy = [...list]
      filterExpenses(list, { accountId: 'acc_2' })
      expect(list).toEqual(copy)
    })
  })

  describe('dayTotal', () => {
    it('sums amounts in kuruş', () => {
      const day = [
        mockExpense({ amount: 12345 as Kurus }),
        mockExpense({ amount: 1 as Kurus }),
        mockExpense({ amount: 99900 as Kurus }),
      ]
      expect(dayTotal(day)).toBe(112246)
    })

    it('is zero for an empty day', () => {
      expect(dayTotal([])).toBe(0)
    })
  })
})
