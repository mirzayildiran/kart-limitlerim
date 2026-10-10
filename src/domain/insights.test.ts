import { describe, it, expect } from 'vitest'
import { computeInsights } from './insights'
import { projectedInterest } from './interest'
import { DEFAULT_CATEGORIES } from './categories'
import { formatShort } from './dates'
import { formatTL } from './money'
import type { Insight, InsightInput, InsightKind } from './insightsTypes'
import type { BalanceAccount, CardAccount, CardLine, Expense, KmhAccount } from './types'

const today = new Date(2026, 9, 10)

const line = (over: Partial<CardLine> = {}): CardLine => ({
  id: 'l1',
  label: 'Ana',
  cutDay: 5,
  dueOffsetDays: 10,
  cycle: null,
  payment: 'unpaid',
  ...over,
})

/** A line whose October statement is known: 5M debt, 1M minimum, due 15 Oct. */
const withStatement = (over: Partial<CardLine> = {}): CardLine =>
  line({ cycle: '2026-10', statementDebt: 5_000_000, minimumDue: 1_000_000, dueDate: '2026-10-15', ...over })

const card = (over: Partial<CardAccount> = {}): CardAccount => ({
  id: 'c1',
  kind: 'card',
  name: 'Akbank',
  limit: 10_000_000,
  available: 8_000_000,
  lines: [line()],
  updatedAt: 0,
  createdAt: 0,
  ...over,
})

const kmh = (over: Partial<KmhAccount> = {}): KmhAccount => ({
  id: 'k1',
  kind: 'kmh',
  name: 'Garanti KMH',
  limit: 5_000_000,
  available: 5_000_000,
  updatedAt: 0,
  createdAt: 0,
  ...over,
})

const bank = (balance: number): BalanceAccount => ({
  id: 'b1',
  kind: 'bank',
  name: 'Ziraat',
  balance,
  updatedAt: 0,
  createdAt: 0,
})

const exp = (categoryId: string, amount: number, date: string): Expense => ({
  id: `e-${categoryId}-${date}-${amount}`,
  amount,
  categoryId,
  accountId: 'c1',
  date,
  note: '',
  affectsAccount: false,
  installments: 1,
  source: 'manual',
  createdAt: 0,
})

const input = (over: Partial<InsightInput> = {}): InsightInput => ({
  accounts: [],
  expenses: [],
  categories: DEFAULT_CATEGORIES,
  recurring: [],
  today,
  ...over,
})

const byKind = (xs: Insight[], kind: InsightKind) => xs.filter((x) => x.kind === kind)

describe('computeInsights', () => {
  it('returns nothing for an empty budget', () => {
    expect(computeInsights(input())).toEqual([])
  })

  describe('cashShortfall', () => {
    it('fires when cash cannot cover the minimum before the next cut', () => {
      const result = computeInsights(
        input({ accounts: [bank(100_000), card({ lines: [withStatement()] })] }),
      )
      const [s] = byKind(result, 'cashShortfall')
      expect(s).toMatchObject({ id: 'cashShortfall', severity: 'crit', amount: 900_000 })
      expect(s.body).toContain(formatTL(900_000))
      expect(s.body).toContain(formatShort(new Date(2026, 10, 5)))
    })

    it('does not fire when cash covers the minimum', () => {
      const result = computeInsights(
        input({ accounts: [bank(2_000_000), card({ lines: [withStatement()] })] }),
      )
      expect(byKind(result, 'cashShortfall')).toHaveLength(0)
    })
  })

  describe('statementDue', () => {
    const cardWith = (over: Partial<CardLine>) => card({ lines: [withStatement(over)] })

    it('warns when the minimum is due in a few days', () => {
      const [s] = byKind(computeInsights(input({ accounts: [cardWith({ dueDate: '2026-10-12' })] })), 'statementDue')
      expect(s).toMatchObject({ id: 'statementDue:c1:0', severity: 'warn', amount: 1_000_000 })
      expect(s.title).toBe('Akbank asgari ödemesi 2 gün sonra')
      expect(s.body).toContain(formatTL(1_000_000))
      expect(s.body).not.toContain('tahmini')
    })

    it('warns when the minimum is due today', () => {
      const [s] = byKind(computeInsights(input({ accounts: [cardWith({ dueDate: '2026-10-10' })] })), 'statementDue')
      expect(s).toMatchObject({ severity: 'warn', title: 'Akbank asgari ödemesi bugün' })
    })

    it('is critical when the minimum is overdue', () => {
      const [s] = byKind(computeInsights(input({ accounts: [cardWith({ dueDate: '2026-10-08' })] })), 'statementDue')
      expect(s).toMatchObject({ severity: 'crit', title: 'Akbank asgari ödemesi gecikti' })
    })

    it('does not fire when the due date is further away', () => {
      const result = computeInsights(input({ accounts: [cardWith({ dueDate: '2026-10-15' })] }))
      expect(byKind(result, 'statementDue')).toHaveLength(0)
    })

    it('does not fire when the statement is already paid', () => {
      const result = computeInsights(input({ accounts: [cardWith({ dueDate: '2026-10-12', payment: 'minimum' })] }))
      expect(byKind(result, 'statementDue')).toHaveLength(0)
    })

    it('marks an estimated minimum as tahmini', () => {
      const [s] = byKind(
        computeInsights(input({ accounts: [cardWith({ dueDate: '2026-10-12', minimumDue: null })] })),
        'statementDue',
      )
      // 20% of the 5M statement debt on a card up to 10M limit.
      expect(s.amount).toBe(1_000_000)
      expect(s.body).toContain('tahmini')
    })

    it('names the line when the card has several lines', () => {
      const multi = card({
        lines: [
          withStatement({ id: 'l1', label: 'Ana', dueDate: '2026-10-12' }),
          withStatement({ id: 'l2', label: 'Dijital', dueDate: '2026-10-12' }),
        ],
      })
      const items = byKind(computeInsights(input({ accounts: [multi] })), 'statementDue')
      expect(items.map((i) => i.id)).toEqual(['statementDue:c1:0', 'statementDue:c1:1'])
      expect(items[1].title).toBe('Akbank Dijital asgari ödemesi 2 gün sonra')
    })
  })

  describe('cardNearLimit', () => {
    it('warns when a card has less than 10% of its limit free', () => {
      const [s] = byKind(computeInsights(input({ accounts: [card({ available: 500_000 })] })), 'cardNearLimit')
      expect(s).toMatchObject({ id: 'cardNearLimit:c1', severity: 'warn', title: 'Akbank limiti azalıyor' })
      expect(s.body).toContain(formatTL(500_000))
    })

    it('warns when a KMH has no free limit left', () => {
      const [s] = byKind(computeInsights(input({ accounts: [kmh({ available: 0 })] })), 'cardNearLimit')
      expect(s).toMatchObject({ id: 'cardNearLimit:k1', severity: 'warn', title: 'Garanti KMH limiti doldu', amount: 0 })
    })

    it('does not fire while the limit is comfortably free', () => {
      const result = computeInsights(input({ accounts: [card({ available: 8_000_000 })] }))
      expect(byKind(result, 'cardNearLimit')).toHaveLength(0)
    })
  })

  describe('kmhInterest', () => {
    it('estimates the daily cost of the used KMH balance at the cash rate', () => {
      // 2M used × 4.25% / 30 × 1.3 = 3683 kuruş per day.
      const [s] = byKind(computeInsights(input({ accounts: [kmh({ available: 3_000_000 })] })), 'kmhInterest')
      expect(s).toMatchObject({ id: 'kmhInterest:k1', severity: 'warn', amount: 3683 })
      expect(s.body).toContain(formatTL(3683))
      expect(s.body).toContain('tahmini')
    })

    it('uses the account rate override when present', () => {
      // 2M used × 5% / 30 × 1.3 = 4333 kuruş per day.
      const [s] = byKind(
        computeInsights(
          input({ accounts: [kmh({ available: 3_000_000, rateOverride: { contractual: 5, late: 5.5 } })] }),
        ),
        'kmhInterest',
      )
      expect(s.amount).toBe(4333)
    })

    it('does not fire when nothing is used', () => {
      const result = computeInsights(input({ accounts: [kmh({ available: 5_000_000 })] }))
      expect(byKind(result, 'kmhInterest')).toHaveLength(0)
    })
  })

  describe('minimumInterest', () => {
    it('shows the interest that paying only the minimum would carry', () => {
      const a = card({ lines: [withStatement()] })
      const [s] = byKind(computeInsights(input({ accounts: [a] })), 'minimumInterest')
      const expected = projectedInterest(a, 0, today, 'minimum')!.total
      expect(expected).toBeGreaterThan(0)
      expect(s).toMatchObject({ id: 'minimumInterest:c1:0', severity: 'info', amount: expected })
      expect(s.body).toBe(
        `Yalnızca asgariyi ödersen sonraki ekstreye tahmini ${formatTL(expected)} faiz yansır.`,
      )
    })

    it('does not fire for a statement that is already paid', () => {
      const result = computeInsights(input({ accounts: [card({ lines: [withStatement({ payment: 'minimum' })] })] }))
      expect(byKind(result, 'minimumInterest')).toHaveLength(0)
    })

    it('does not fire when the statement debt is unknown', () => {
      const result = computeInsights(input({ accounts: [card({ lines: [line()] })] }))
      expect(byKind(result, 'minimumInterest')).toHaveLength(0)
    })
  })

  describe('categoryIncrease', () => {
    it('fires when this month is at least 30% above the same days last month', () => {
      const result = computeInsights(
        input({
          accounts: [card()],
          expenses: [exp('yemek', 60_000, '2026-10-03'), exp('yemek', 40_000, '2026-09-02')],
        }),
      )
      const [s] = byKind(result, 'categoryIncrease')
      expect(s).toMatchObject({ id: 'categoryIncrease:yemek', severity: 'warn', title: 'Yemek harcaması arttı', amount: 20_000 })
      expect(s.body).toContain(formatTL(60_000))
      expect(s.body).toContain(formatTL(40_000))
      expect(s.body).toContain('%50')
    })

    it('ignores days after today and days after the same span last month', () => {
      const result = computeInsights(
        input({
          expenses: [
            exp('yemek', 60_000, '2026-10-03'),
            exp('yemek', 500_000, '2026-10-20'),
            exp('yemek', 40_000, '2026-09-02'),
            exp('yemek', 500_000, '2026-09-25'),
          ],
        }),
      )
      const [s] = byKind(result, 'categoryIncrease')
      expect(s.body).toContain(formatTL(60_000))
      expect(s.body).toContain(formatTL(40_000))
    })

    it('keeps at most three categories, largest increase first', () => {
      const result = computeInsights(
        input({
          expenses: [
            exp('yemek', 120_000, '2026-10-03'),
            exp('yemek', 50_000, '2026-09-03'),
            exp('market', 90_000, '2026-10-03'),
            exp('market', 60_000, '2026-09-03'),
            exp('ulasim', 200_000, '2026-10-03'),
            exp('ulasim', 100_000, '2026-09-03'),
            exp('eglence', 80_000, '2026-10-03'),
            exp('eglence', 40_000, '2026-09-03'),
          ],
        }),
      )
      const items = byKind(result, 'categoryIncrease')
      // Diffs: ulasim 100k, yemek 70k, eglence 40k, market 30k (cut).
      expect(items.map((i) => i.id)).toEqual([
        'categoryIncrease:ulasim',
        'categoryIncrease:yemek',
        'categoryIncrease:eglence',
      ])
    })

    it('uses "Diğer" for an unknown category', () => {
      const [s] = byKind(
        computeInsights(
          input({ expenses: [exp('silinmis', 60_000, '2026-10-03'), exp('silinmis', 40_000, '2026-09-03')] }),
        ),
        'categoryIncrease',
      )
      expect(s.title).toBe('Diğer harcaması arttı')
    })

    it('does not fire below 500 ₺ this month', () => {
      const result = computeInsights(
        input({ expenses: [exp('yemek', 40_000, '2026-10-03'), exp('yemek', 10_000, '2026-09-03')] }),
      )
      expect(byKind(result, 'categoryIncrease')).toHaveLength(0)
    })

    it('does not fire below the 30% threshold', () => {
      const result = computeInsights(
        input({ expenses: [exp('yemek', 60_000, '2026-10-03'), exp('yemek', 50_000, '2026-09-03')] }),
      )
      expect(byKind(result, 'categoryIncrease')).toHaveLength(0)
    })

    it('does not fire when last month had no spending in that category', () => {
      const result = computeInsights(input({ expenses: [exp('yemek', 60_000, '2026-10-03')] }))
      expect(byKind(result, 'categoryIncrease')).toHaveLength(0)
    })
  })

  describe('bestCard', () => {
    // Akbank: cut 5, due 10 days after the next cut → Nov 16, 37 days away.
    const akbank = card({ id: 'c1', name: 'Akbank', available: 3_000_000, lines: [line({ cutDay: 5, dueOffsetDays: 10 })] })
    // Yapı Kredi: cut 20, due 5 days after the next cut → Oct 26, 16 days away.
    const yapi = card({
      id: 'c2',
      name: 'Yapı Kredi',
      available: 5_000_000,
      lines: [line({ cutDay: 20, dueOffsetDays: 5 })],
    })

    it('picks the card with the longest interest-free period, even with less free limit', () => {
      const [s] = byKind(computeInsights(input({ accounts: [akbank, yapi] })), 'bestCard')
      expect(s).toMatchObject({ id: 'bestCard:c1', severity: 'info', title: 'Bugünkü alışveriş için Akbank', amount: 3_000_000 })
      expect(s.body).toContain('37 gün sonra')
      expect(s.body).toContain(formatTL(3_000_000))
    })

    it('breaks a tie with the larger free limit', () => {
      const a = card({ id: 'c1', name: 'Akbank', available: 2_000_000, lines: [line()] })
      const b = card({ id: 'c2', name: 'Yapı Kredi', available: 6_000_000, lines: [line()] })
      const [s] = byKind(computeInsights(input({ accounts: [a, b] })), 'bestCard')
      expect(s.title).toBe('Bugünkü alışveriş için Yapı Kredi')
    })

    it('needs at least two cards with free limit', () => {
      expect(byKind(computeInsights(input({ accounts: [akbank] })), 'bestCard')).toHaveLength(0)
      const spent = { ...yapi, available: 0 }
      expect(byKind(computeInsights(input({ accounts: [akbank, spent] })), 'bestCard')).toHaveLength(0)
    })
  })

  describe('ordering', () => {
    it('sorts crit, then warn, then info, keeping rule order within a severity', () => {
      const result = computeInsights(
        input({
          accounts: [
            bank(100_000),
            card({ id: 'c1', name: 'Akbank', available: 500_000, lines: [withStatement({ dueDate: '2026-10-12' })] }),
            card({ id: 'c2', name: 'Yapı Kredi', available: 8_000_000, lines: [line({ cutDay: 20, dueOffsetDays: 10 })] }),
          ],
        }),
      )
      expect(result.map((i) => i.kind)).toEqual([
        'cashShortfall',
        'statementDue',
        'cardNearLimit',
        'minimumInterest',
        'bestCard',
      ])
      expect(result.map((i) => i.severity)).toEqual(['crit', 'warn', 'warn', 'info', 'info'])
    })
  })
})
