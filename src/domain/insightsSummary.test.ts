import { describe, it, expect } from 'vitest'
import { budgetSummary, categoryComparison } from './insightsSummary'
import type { Insight, InsightInput } from './insightsTypes'
import type { BalanceAccount, CardAccount, CardLine, Category, Expense, KmhAccount } from './types'

const today = new Date(2026, 9, 10)

const meta = { updatedAt: 0, createdAt: 0 }

function line(overrides: Partial<CardLine> = {}): CardLine {
  return {
    id: 'line-1',
    label: 'Ana kart',
    cutDay: 5,
    dueOffsetDays: 10,
    cycle: '2026-10',
    statementDebt: 2000000,
    minimumDue: 400000,
    payment: 'unpaid',
    ...overrides,
  }
}

function card(overrides: Partial<CardAccount> = {}): CardAccount {
  return {
    id: 'acc-kart-7731',
    kind: 'card',
    name: 'Deneme Kart',
    limit: 10000000,
    available: 6000000,
    lines: [line()],
    ...meta,
    ...overrides,
  }
}

const kmh: KmhAccount = {
  id: 'acc-kmh-4410',
  kind: 'kmh',
  name: 'Deneme KMH',
  limit: 5000000,
  available: 3000000,
  ...meta,
}

const bank: BalanceAccount = {
  id: 'acc-banka-9020',
  kind: 'bank',
  name: 'Deneme Banka',
  balance: 2500000,
  ...meta,
}

const cash: BalanceAccount = {
  id: 'acc-nakit-1186',
  kind: 'cash',
  name: 'Deneme Nakit',
  balance: 150000,
  ...meta,
}

const categories: Category[] = [
  { id: 'yemek', name: 'Yemek', hue: 24, builtin: true, order: 0 },
  { id: 'ulasim', name: 'Ulaşım', hue: 205, builtin: true, order: 1 },
  { id: 'market', name: 'Market', hue: 140, builtin: true, order: 2 },
]

function expense(overrides: Partial<Expense> & Pick<Expense, 'date' | 'amount' | 'categoryId'>): Expense {
  return {
    id: `exp-${overrides.date}-${overrides.amount}`,
    accountId: 'acc-kart-7731',
    note: '',
    affectsAccount: true,
    installments: 1,
    source: 'manual',
    createdAt: 0,
    ...overrides,
  }
}

function input(overrides: Partial<InsightInput> = {}): InsightInput {
  return {
    accounts: [card(), kmh, bank, cash],
    expenses: [],
    categories,
    recurring: [],
    today,
    ...overrides,
  }
}

describe('budgetSummary', () => {
  it('formats power and the date', () => {
    const s = budgetSummary(input(), [])
    expect(s.date).toBe('2026-10-10')
    expect(s.power).toEqual({
      total: '116.500 ₺',
      cards: '60.000 ₺',
      kmh: '30.000 ₺',
      cash: '26.500 ₺',
    })
  })

  it('looks ahead to the nearest statement cut with formatted figures', () => {
    const s = budgetSummary(input(), [])
    expect(s.outlook).toEqual({
      until: '2026-11-05',
      days: 26,
      minimums: '4.000 ₺',
      unknownMinimums: 0,
      recurring: '0 ₺',
      powerAfter: '116.500 ₺',
      cashAfter: '52.500 ₺',
      shortfall: false,
    })
  })

  it('flags a shortfall when cash after obligations is negative', () => {
    const s = budgetSummary(input({ accounts: [card({ lines: [line({ minimumDue: 6000000 })] }), kmh, bank, cash] }), [])
    expect(s.outlook.shortfall).toBe(true)
    expect(s.outlook.cashAfter).toContain('3.500')
  })

  it('orders accounts cards, KMH, bank, cash and keeps input order within a group', () => {
    const card2 = card({ id: 'acc-kart-2', name: 'Ikinci Kart', lines: [] })
    const s = budgetSummary(input({ accounts: [cash, bank, kmh, card(), card2] }), [])
    expect(s.accounts.map((a) => [a.kind, a.name])).toEqual([
      ['kart', 'Deneme Kart'],
      ['kart', 'Ikinci Kart'],
      ['KMH', 'Deneme KMH'],
      ['banka', 'Deneme Banka'],
      ['nakit', 'Deneme Nakit'],
    ])
  })

  it('gives limit only to card and KMH, and balance-only fields to bank and cash', () => {
    const s = budgetSummary(input(), [])
    const [kartS, kmhS, bankS, cashS] = s.accounts
    expect(kartS.available).toBe('60.000 ₺')
    expect(kartS.limit).toBe('100.000 ₺')
    expect(kmhS.limit).toBe('50.000 ₺')
    expect(bankS.available).toBe('25.000 ₺')
    expect('limit' in bankS).toBe(false)
    expect('limit' in cashS).toBe(false)
    expect('nextCut' in kmhS).toBe(false)
  })

  it('reports the nearest open statement for a card', () => {
    const s = budgetSummary(input(), [])
    const kartS = s.accounts[0]
    expect(kartS).toEqual({
      name: 'Deneme Kart',
      kind: 'kart',
      available: '60.000 ₺',
      limit: '100.000 ₺',
      nextCut: '2026-11-05',
      due: '2026-10-15',
      statementDebt: '20.000 ₺',
      minimumOutstanding: '4.000 ₺',
      paid: false,
    })
  })

  it('omits optional card fields that are unknown', () => {
    const noLines = budgetSummary(input({ accounts: [card({ lines: [] })] }), []).accounts[0]
    expect('nextCut' in noLines).toBe(false)
    expect('due' in noLines).toBe(false)
    expect('paid' in noLines).toBe(false)

    const noDebt = budgetSummary(
      input({ accounts: [card({ lines: [line({ statementDebt: null, minimumDue: null })] })] }),
      [],
    ).accounts[0]
    expect('statementDebt' in noDebt).toBe(false)
    expect(noDebt.nextCut).toBe('2026-11-05')
  })

  it('picks the card statement with the earliest unpaid due date', () => {
    const paidEarlier = line({ id: 'l-paid', cutDay: 1, payment: 'full', cycle: '2026-10' })
    const open = line({ id: 'l-open', cutDay: 5 })
    const s = budgetSummary(input({ accounts: [card({ lines: [paidEarlier, open] })] }), [])
    expect(s.accounts[0].paid).toBe(false)
    expect(s.accounts[0].nextCut).toBe('2026-11-05')
  })

  it('compares categories and maps them to formatted summary rows', () => {
    const expenses = [
      expense({ date: '2026-10-03', amount: 10000, categoryId: 'yemek' }),
      expense({ date: '2026-10-10', amount: 2000, categoryId: 'yemek' }),
      expense({ date: '2026-09-10', amount: 7000, categoryId: 'yemek' }),
      expense({ date: '2026-09-01', amount: 4000, categoryId: 'market' }),
      expense({ date: '2026-10-05', amount: 3000, categoryId: 'ulasim' }),
    ]
    const s = budgetSummary(input({ expenses }), [])
    expect(s.categories).toEqual([
      { name: 'Yemek', thisMonth: '120 ₺', lastMonthSamePeriod: '70 ₺', changePercent: 71 },
      { name: 'Ulaşım', thisMonth: '30 ₺', lastMonthSamePeriod: '0 ₺', changePercent: null },
      { name: 'Market', thisMonth: '0 ₺', lastMonthSamePeriod: '40 ₺', changePercent: -100 },
    ])
  })

  it('caps categories at eight', () => {
    const many: Category[] = Array.from({ length: 10 }, (_, i) => ({
      id: `c${i}`,
      name: `Kategori ${i}`,
      hue: i,
      builtin: false,
      order: i,
    }))
    const expenses = many.map((c, i) => expense({ date: '2026-10-01', amount: (i + 1) * 100, categoryId: c.id }))
    const s = budgetSummary(input({ categories: many, expenses }), [])
    expect(s.categories).toHaveLength(8)
    expect(s.categories[0].name).toBe('Kategori 9')
  })

  it('caps insights at ten and keeps only severity, title and body', () => {
    const insights: Insight[] = Array.from({ length: 12 }, (_, i) => ({
      id: `info:${i}`,
      kind: 'bestCard',
      severity: 'info',
      title: `Başlık ${i}`,
      body: `Gövde ${i}.`,
      amount: 100,
    }))
    const s = budgetSummary(input(), insights)
    expect(s.insights).toHaveLength(10)
    expect(Object.keys(s.insights[0])).toEqual(['severity', 'title', 'body'])
  })

  it('never includes expense notes, expense ids, account ids or recurring names', () => {
    const expenses = [
      expense({ id: 'exp-gizli-001', date: '2026-10-02', amount: 5000, categoryId: 'yemek', note: 'GIZLI-NOT-XYZ' }),
    ]
    const recurring = [
      {
        id: 'rec-gizli-001',
        name: 'Gizli Abonelik',
        amount: 9900,
        categoryId: 'yemek',
        accountId: 'acc-kart-7731',
        dayOfMonth: 12,
        startDate: '2026-01-01',
        end: { type: 'never' as const },
        active: true,
        createdAt: 0,
      },
    ]
    const s = budgetSummary(input({ expenses, recurring }), [])
    const json = JSON.stringify(s)
    expect(json).not.toContain('GIZLI-NOT-XYZ')
    expect(json).not.toContain('exp-gizli')
    expect(json).not.toContain('rec-gizli')
    expect(json).not.toContain('Gizli Abonelik')
    expect(json).not.toContain('acc-')
  })
})

describe('categoryComparison', () => {
  it('counts this month up to today and last month up to the same day', () => {
    const expenses = [
      expense({ date: '2026-10-03', amount: 10000, categoryId: 'yemek' }), // this month, counted
      expense({ date: '2026-10-10', amount: 2000, categoryId: 'yemek' }), // today, counted
      expense({ date: '2026-10-11', amount: 9000, categoryId: 'yemek' }), // future day, not counted
      expense({ date: '2026-09-10', amount: 7000, categoryId: 'yemek' }), // last month same day, counted
      expense({ date: '2026-09-11', amount: 5000, categoryId: 'yemek' }), // last month after same day, not counted
    ]
    expect(categoryComparison(input({ expenses }))).toEqual([
      { categoryId: 'yemek', name: 'Yemek', thisMonth: 12000, lastMonthSamePeriod: 7000 },
    ])
  })

  it('clamps last month to its length', () => {
    const march31 = new Date(2026, 2, 31)
    const expenses = [expense({ date: '2026-02-28', amount: 4000, categoryId: 'market' })]
    expect(categoryComparison(input({ expenses, today: march31 }))).toEqual([
      { categoryId: 'market', name: 'Market', thisMonth: 0, lastMonthSamePeriod: 4000 },
    ])
  })

  it('drops categories with no spending in either window and sorts by this month', () => {
    const expenses = [
      expense({ date: '2026-10-01', amount: 1000, categoryId: 'market' }),
      expense({ date: '2026-10-02', amount: 3000, categoryId: 'ulasim' }),
      expense({ date: '2026-08-02', amount: 9000, categoryId: 'yemek' }), // older month, ignored
    ]
    const result = categoryComparison(input({ expenses }))
    expect(result.map((r) => r.categoryId)).toEqual(['ulasim', 'market'])
  })

  it('falls back to "Diğer" for an unknown category id', () => {
    const expenses = [expense({ date: '2026-10-01', amount: 1000, categoryId: 'silinmis' })]
    expect(categoryComparison(input({ expenses }))[0].name).toBe('Diğer')
  })
})
