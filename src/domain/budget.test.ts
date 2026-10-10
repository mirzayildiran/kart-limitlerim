import { describe, it, expect } from 'vitest'
import { budgetProgress, monthPace } from './budget'
import type { Category, CategoryBudget, Expense } from './types'

// 10 Oct 2026: 10 days in, 31 in the month. September has 30 days.
const today = new Date(2026, 9, 10)

const cat = (id: string, name: string): Category => ({ id, name, hue: 0, builtin: true, order: 0 })

const categories: Category[] = [
  cat('yemek', 'Yemek'),
  cat('market', 'Market'),
  cat('ulasim', 'Ulaşım'),
  cat('eglence', 'Eğlence'),
  cat('giyim', 'Giyim'),
  cat('saglik', 'Sağlık'),
]

const exp = (categoryId: string, amount: number, date: string): Expense => ({
  id: `e-${categoryId}-${date}-${amount}`,
  amount,
  categoryId,
  accountId: 'acc-1',
  date,
  note: '',
  affectsAccount: false,
  installments: 1,
  source: 'manual',
  createdAt: 0,
})

const budget = (categoryId: string, monthly: number): CategoryBudget => ({ categoryId, monthly })

describe('monthPace', () => {
  it('sums this month up to today and last month up to the same day', () => {
    const expenses = [
      exp('yemek', 10_000, '2026-10-03'), // this month
      exp('yemek', 2_000, '2026-10-10'), // today, counted
      exp('yemek', 9_000, '2026-10-11'), // future, ignored
      exp('yemek', 7_000, '2026-09-10'), // last month, same period
      exp('yemek', 5_000, '2026-09-11'), // last month, after the same period
      exp('yemek', 3_000, '2026-09-30'), // last month, whole-month total only
      exp('yemek', 100, '2026-08-05'), // two months back, ignored
    ]
    expect(monthPace(expenses, today)).toEqual({
      spent: 12_000,
      lastMonthSamePeriod: 7_000,
      lastMonthTotal: 15_000,
      projected: 37_200,
      daysPassed: 10,
      daysInMonth: 31,
    })
  })

  it('rounds the projection to whole kuruş', () => {
    // 100 kuruş in 3 days over 31 days: 1033.33 → 1033.
    const pace = monthPace([exp('yemek', 100, '2026-10-02')], new Date(2026, 9, 3))
    expect(pace.projected).toBe(1033)
  })

  it('clamps last month to its length on the 31st', () => {
    // 31 March: February has 28 days, so the same period is all of February.
    const march31 = new Date(2026, 2, 31)
    const expenses = [
      exp('yemek', 1_000, '2026-03-31'),
      exp('yemek', 500, '2026-03-01'),
      exp('market', 4_000, '2026-02-28'),
      exp('market', 1_000, '2026-02-01'),
      exp('market', 9_999, '2026-01-31'), // January, ignored
    ]
    expect(monthPace(expenses, march31)).toEqual({
      spent: 1_500,
      lastMonthSamePeriod: 5_000,
      lastMonthTotal: 5_000,
      projected: 1_500,
      daysPassed: 31,
      daysInMonth: 31,
    })
  })

  it('looks back across the year boundary', () => {
    const jan15 = new Date(2026, 0, 15)
    const expenses = [
      exp('yemek', 4_000, '2025-12-15'),
      exp('yemek', 6_000, '2025-12-31'),
      exp('yemek', 1_000, '2026-01-02'),
    ]
    const pace = monthPace(expenses, jan15)
    expect(pace.lastMonthSamePeriod).toBe(4_000)
    expect(pace.lastMonthTotal).toBe(10_000)
    expect(pace.spent).toBe(1_000)
  })
})

describe('budgetProgress', () => {
  it('reports spent, remaining, used percent and projection for one budget', () => {
    const rows = budgetProgress([exp('yemek', 120_000, '2026-10-03')], [budget('yemek', 100_000)], categories, today)
    expect(rows).toEqual([
      {
        categoryId: 'yemek',
        name: 'Yemek',
        monthly: 100_000,
        spent: 120_000,
        remaining: -20_000,
        usedPercent: 120,
        projected: 372_000,
        status: 'over',
      },
    ])
  })

  it('marks over when spending already exceeds the target', () => {
    const [row] = budgetProgress([exp('yemek', 100_001, '2026-10-01')], [budget('yemek', 100_000)], categories, today)
    expect(row.status).toBe('over')
  })

  it('marks pace when the month-end estimate exceeds the target', () => {
    // 1.000 ₺ in 10 days projects to 3.100 ₺ over 31 days; target 3.000 ₺.
    const [row] = budgetProgress([exp('market', 100_000, '2026-10-02')], [budget('market', 300_000)], categories, today)
    expect(row).toMatchObject({ spent: 100_000, projected: 310_000, usedPercent: 33, status: 'pace' })
  })

  it('marks near at 80% used, and not below it', () => {
    // 28 Oct: 28 of 31 days. 800 ₺ of 1.000 ₺ is 80%, projected 885,71 ₺ (under target).
    const late = new Date(2026, 9, 28)
    const [atEighty] = budgetProgress([exp('yemek', 80_000, '2026-10-20')], [budget('yemek', 100_000)], categories, late)
    expect(atEighty).toMatchObject({ projected: 88_571, usedPercent: 80, status: 'near' })

    const [belowEighty] = budgetProgress([exp('yemek', 79_999, '2026-10-20')], [budget('yemek', 100_000)], categories, late)
    expect(belowEighty.status).toBe('ok')
  })

  it('marks ok when well under the target and on pace', () => {
    // 900 ₺ in 10 days projects to 2.790 ₺ against a 3.000 ₺ target.
    const [row] = budgetProgress([exp('ulasim', 90_000, '2026-10-01')], [budget('ulasim', 300_000)], categories, today)
    expect(row).toMatchObject({ projected: 279_000, usedPercent: 30, status: 'ok' })
  })

  it('does not mark pace before the seventh day of the month', () => {
    // 5 Oct: 300 ₺ projects to 1.860 ₺ against a 1.000 ₺ target, but the pace guard holds.
    const fifth = new Date(2026, 9, 5)
    const [row] = budgetProgress([exp('market', 30_000, '2026-10-02')], [budget('market', 100_000)], categories, fifth)
    expect(row).toMatchObject({ projected: 186_000, status: 'ok' })
  })

  it('marks pace from the seventh day of the month', () => {
    const seventh = new Date(2026, 9, 7)
    const [row] = budgetProgress([exp('market', 30_000, '2026-10-02')], [budget('market', 100_000)], categories, seventh)
    expect(row.status).toBe('pace')
  })

  it('prefers over to pace when both apply', () => {
    const [row] = budgetProgress([exp('yemek', 120_000, '2026-10-03')], [budget('yemek', 100_000)], categories, today)
    expect(row.status).toBe('over')
  })

  it('ignores future-dated expenses and expenses from other months', () => {
    const expenses = [
      exp('yemek', 50_000, '2026-10-09'),
      exp('yemek', 999_999, '2026-10-11'), // future
      exp('yemek', 70_000, '2026-09-09'), // last month
    ]
    const [row] = budgetProgress(expenses, [budget('yemek', 100_000)], categories, today)
    expect(row).toMatchObject({ spent: 50_000, remaining: 50_000 })
  })

  it('skips budgets whose category no longer exists', () => {
    const rows = budgetProgress(
      [],
      [budget('silinmis', 100_000), budget('market', 100_000)],
      categories,
      today,
    )
    expect(rows.map((r) => r.categoryId)).toEqual(['market'])
  })

  it('skips a budget with no positive target', () => {
    expect(budgetProgress([exp('market', 1_000, '2026-10-01')], [budget('market', 0)], categories, today)).toEqual([])
  })

  it('uses the 31st of March against a short February', () => {
    const march31 = new Date(2026, 2, 31)
    const expenses = [exp('yemek', 9_000, '2026-03-31'), exp('yemek', 50_000, '2026-02-28')]
    const [row] = budgetProgress(expenses, [budget('yemek', 10_000)], categories, march31)
    expect(row).toMatchObject({ spent: 9_000, projected: 9_000, usedPercent: 90, status: 'near' })
  })

  it('sorts over, pace, near, ok, then by used percent', () => {
    // 28 Oct: 28 of 31 days elapsed.
    const late = new Date(2026, 9, 28)
    const expenses = [
      exp('yemek', 110_000, '2026-10-20'), // over
      exp('market', 95_000, '2026-10-20'), // pace
      exp('eglence', 180_000, '2026-10-20'), // near 90%
      exp('giyim', 85_000, '2026-10-20'), // near 85%
      exp('saglik', 30_000, '2026-10-20'), // ok 30%
      exp('ulasim', 50_000, '2026-10-20'), // ok 17%
    ]
    // Budgets given in a shuffled order.
    const budgets = [
      budget('ulasim', 300_000),
      budget('giyim', 100_000),
      budget('market', 100_000),
      budget('saglik', 100_000),
      budget('yemek', 100_000),
      budget('eglence', 200_000),
    ]
    const rows = budgetProgress(expenses, budgets, categories, late)
    expect(rows.map((r) => [r.categoryId, r.status, r.usedPercent])).toEqual([
      ['yemek', 'over', 110],
      ['market', 'pace', 95],
      ['eglence', 'near', 90],
      ['giyim', 'near', 85],
      ['saglik', 'ok', 30],
      ['ulasim', 'ok', 17],
    ])
  })
})
