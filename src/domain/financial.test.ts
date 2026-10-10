import { describe, expect, it } from 'vitest'
import { fromIso, toIso } from './dates'
import { HOLIDAY_YEARS, holidaysOf, isBusinessDay, isHoliday, nextBusinessDay } from './holidays'
import { closeCycle, statementInterest } from './interest'
import { cardTierFor, CURRENT_RATES, defaultRates, estimateMinimum, MINIMUM_RULE, minimumRatio, withTaxes } from './rates'
import { estimatedDueDate, lastCut, nextCut, viewStatement } from './statement'
import type { CardAccount, CardLine } from './types'

/**
 * Table-driven checks of the money-relevant date and rate rules: month ends, February and leap
 * years, the year boundary, Turkish holidays, minimum payment and interest tiers.
 */

const d = fromIso

describe('statement cut at month ends', () => {
  it.each([
    // cutDay, today, last cut, next cut
    [31, '2026-01-31', '2026-01-31', '2026-02-28'],
    [31, '2026-02-27', '2026-01-31', '2026-02-28'],
    [31, '2026-02-28', '2026-02-28', '2026-03-31'],
    [31, '2026-03-01', '2026-02-28', '2026-03-31'],
    [31, '2026-04-30', '2026-04-30', '2026-05-31'],
    [31, '2028-02-28', '2028-01-31', '2028-02-29'],
    [31, '2028-02-29', '2028-02-29', '2028-03-31'],
    [30, '2026-02-28', '2026-02-28', '2026-03-30'],
    [30, '2028-02-29', '2028-02-29', '2028-03-30'],
    [29, '2026-02-28', '2026-02-28', '2026-03-29'],
    [29, '2028-02-28', '2028-01-29', '2028-02-29'],
    [29, '2027-03-28', '2027-02-28', '2027-03-29'],
    [1, '2026-12-31', '2026-12-01', '2027-01-01'],
    [1, '2027-01-01', '2027-01-01', '2027-02-01'],
    [31, '2026-12-31', '2026-12-31', '2027-01-31'],
    [31, '2027-01-15', '2026-12-31', '2027-01-31'],
    [15, '2027-01-14', '2026-12-15', '2027-01-15'],
  ])('cutDay %i on %s: last %s, next %s', (cutDay, today, last, next) => {
    expect(toIso(lastCut(cutDay, d(today)))).toBe(last)
    expect(toIso(nextCut(cutDay, d(today)))).toBe(next)
  })

  it('never skips or repeats a month for any cut day over four years', () => {
    for (let cutDay = 1; cutDay <= 31; cutDay++) {
      let prev = lastCut(cutDay, d('2025-12-31'))
      for (let t = d('2026-01-01'); t <= d('2029-12-31'); t = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1)) {
        const cut = lastCut(cutDay, t)
        if (cut.getTime() !== prev.getTime()) {
          const months = (cut.getFullYear() - prev.getFullYear()) * 12 + cut.getMonth() - prev.getMonth()
          expect(months).toBe(1)
          prev = cut
        }
        expect(cut <= t).toBe(true)
        expect(nextCut(cutDay, t) > t).toBe(true)
      }
    }
  })
})

describe('holiday table', () => {
  it.each([
    ['2026-01-01', true],
    ['2026-03-19', false], // Ramazan Bayramı arifesi, half day
    ['2026-03-20', true],
    ['2026-03-22', true],
    ['2026-03-23', false],
    ['2026-04-23', true],
    ['2026-05-01', true],
    ['2026-05-19', true],
    ['2026-05-26', false], // Kurban Bayramı arifesi
    ['2026-05-27', true],
    ['2026-05-30', true],
    ['2026-07-15', true],
    ['2026-08-30', true],
    ['2026-10-28', false], // Cumhuriyet Bayramı arifesi
    ['2026-10-29', true],
    ['2027-03-09', true],
    ['2027-05-19', true],
    ['2028-02-26', true],
    ['2028-02-28', true],
    ['2028-02-29', false],
    ['2028-05-04', false],
    ['2028-05-08', true],
    ['2029-01-01', true], // fixed days are known for any year
    ['2029-10-29', true],
  ])('%s holiday: %s', (date, expected) => {
    expect(isHoliday(d(date))).toBe(expected)
  })

  it('lists valid dates for every covered year, with three Ramazan and four Kurban days', () => {
    for (let y = HOLIDAY_YEARS.from; y <= HOLIDAY_YEARS.to; y++) {
      const list = holidaysOf(y)
      for (const h of list) expect(toIso(d(h.date))).toBe(h.date)
      expect(list.filter((h) => h.name.startsWith('Ramazan') && !h.half)).toHaveLength(3)
      expect(list.filter((h) => h.name.startsWith('Kurban') && !h.half)).toHaveLength(4)
      expect(list.filter((h) => h.half)).toHaveLength(3)
    }
  })

  it('treats weekends and full holidays as non-business days', () => {
    expect(isBusinessDay(d('2026-10-10'))).toBe(false) // Saturday
    expect(isBusinessDay(d('2026-10-29'))).toBe(false)
    expect(isBusinessDay(d('2026-10-28'))).toBe(true)
    expect(isBusinessDay(d('2026-10-30'))).toBe(true)
  })
})

describe('due date moves to the next business day', () => {
  it.each([
    // raw due date, expected due date
    ['2026-10-19', '2026-10-19'], // Monday
    ['2026-10-17', '2026-10-19'], // Saturday
    ['2026-10-18', '2026-10-19'], // Sunday
    ['2026-10-28', '2026-10-28'], // arife: banks work in the morning, not moved
    ['2026-10-29', '2026-10-30'], // Cumhuriyet Bayramı, Thursday
    ['2026-05-27', '2026-06-01'], // Kurban Bayramı (27–30 May) then Sunday
    ['2026-03-20', '2026-03-23'], // Ramazan Bayramı Friday–Sunday
    ['2026-04-23', '2026-04-24'],
    ['2026-07-15', '2026-07-16'],
    ['2026-08-30', '2026-08-31'], // Sunday holiday
    ['2026-12-31', '2026-12-31'],
    ['2027-01-01', '2027-01-04'], // Yılbaşı Friday, year boundary
    ['2027-03-09', '2027-03-12'],
    ['2027-05-15', '2027-05-20'], // Saturday arife, bayram to 19 May (also a holiday)
    ['2028-02-26', '2028-02-29'], // bayram to Monday 28 Feb, then the leap day
    ['2028-05-05', '2028-05-09'],
    ['2029-01-01', '2029-01-02'],
  ])('%s → %s', (raw, expected) => {
    expect(toIso(nextBusinessDay(d(raw)))).toBe(expected)
  })

  it.each([
    // cut, offset, due
    ['2026-10-19', 10, '2026-10-30'],
    ['2026-05-17', 10, '2026-06-01'],
    ['2026-12-22', 10, '2027-01-04'],
    ['2028-02-16', 10, '2028-02-29'],
    ['2026-01-31', 10, '2026-02-10'],
  ])('cut %s + %i days → %s', (cut, offset, due) => {
    expect(toIso(estimatedDueDate(d(cut), offset))).toBe(due)
  })

  const line = (over: Partial<CardLine> = {}): CardLine => ({
    id: 'l',
    label: 'Kart',
    cutDay: 19,
    dueOffsetDays: 10,
    cycle: '2026-10',
    statementDebt: 100_000,
    minimumDue: 20_000,
    payment: 'unpaid',
    ...over,
  })

  it('counts a payment on the moved day as on time', () => {
    const view = viewStatement(line(), d('2026-10-30'))
    expect(toIso(view.due)).toBe('2026-10-30')
    expect(view.status).toBe('today')
    expect(viewStatement(line(), d('2026-10-31')).status).toBe('overdue')
  })

  it('keeps a due date the user copied from the statement as it is', () => {
    const view = viewStatement(line({ dueDate: '2026-10-29' }), d('2026-10-20'))
    expect(toIso(view.due)).toBe('2026-10-29')
    expect(view.dueIsExact).toBe(true)
  })
})

describe('minimum payment', () => {
  it('uses the BDDK threshold of 100.000 ₺, inclusive', () => {
    expect(MINIMUM_RULE.threshold).toBe(10_000_000)
    expect(minimumRatio(10_000_000)).toBe(0.2)
    expect(minimumRatio(10_000_001)).toBe(0.4)
    expect(minimumRatio(0)).toBe(0.2)
  })

  it.each([
    // debt, limit, minimum
    [0, 5_000_000, 0],
    [-100, 5_000_000, 0],
    [1, 5_000_000, 1],
    [5, 5_000_000, 1], // 20% of 5 kuruş rounds up
    [1_280_000, 4_000_000, 256_000],
    [1_280_001, 4_000_000, 256_001],
    [2_000_000, 10_000_000, 400_000],
    [2_000_000, 10_000_001, 800_000],
    [9_999_999, 20_000_000, 4_000_000],
  ])('debt %i on limit %i → %i', (debt, limit, minimum) => {
    expect(estimateMinimum(debt, limit)).toBe(minimum)
  })

  it('is a whole kuruş and never below the exact share for any debt', () => {
    for (let debt = 1; debt < 200_000; debt += 7) {
      for (const limit of [5_000_000, 50_000_000]) {
        const m = estimateMinimum(debt, limit)
        expect(Number.isInteger(m)).toBe(true)
        const pct = limit <= MINIMUM_RULE.threshold ? 20 : 40
        expect(m * 100).toBeGreaterThanOrEqual(debt * pct)
        expect((m - 1) * 100).toBeLessThan(debt * pct)
      }
    }
  })
})

describe('interest rates', () => {
  it.each([
    [0, 3.25, 3.55],
    [2_999_999, 3.25, 3.55],
    [3_000_000, 3.75, 4.05],
    [18_000_000, 3.75, 4.05],
    [18_000_001, 4.25, 4.55],
  ])('statement debt %i → %f / %f', (debt, contractual, late) => {
    expect(cardTierFor(debt)).toMatchObject({ contractual, late })
  })

  it('keeps the late rate 0.30 points above the contractual rate in every tier', () => {
    for (const t of [...CURRENT_RATES.cardTiers, CURRENT_RATES.cash]) {
      expect(Math.round((t.late - t.contractual) * 100)).toBe(30)
    }
  })

  it('starts KMH from the cash rates and cards from the lowest tier', () => {
    expect(defaultRates('kmh')).toEqual({ contractual: 4.25, late: 4.55 })
    expect(defaultRates('card')).toEqual({ contractual: 3.25, late: 3.55 })
  })

  it('adds KKDF and BSMV as exactly 30%', () => {
    expect(withTaxes(100)).toBe(130)
    expect(withTaxes(10_000)).toBe(13_000)
    expect(withTaxes(0)).toBe(0)
  })
})

describe('statement interest', () => {
  const cut = d('2026-10-05')
  const due = d('2026-10-15')
  const next = d('2026-11-05')
  const rate = { contractual: 3.25, late: 3.55 }

  it.each([
    // paid, contractual, late, total
    [0, 29_033, 4_970, 44_203],
    [200_000, 26_867, 0, 34_927],
    [500_000, 16_792, 0, 21_830],
    [1_000_000, 0, 0, 0],
    [1_200_000, 0, 0, 0],
  ])('10.000 ₺ debt, %i paid', (paid, contractual, late, total) => {
    // d1 = 10 days, d2 = 21 days.
    const r = statementInterest({ debt: 1_000_000, minimum: 200_000, paid, cut, due, nextCut: next, rate })
    expect([r.days1, r.days2]).toEqual([10, 21])
    expect(r.contractual).toBe(contractual)
    expect(r.late).toBe(late)
    expect(r.total).toBe(total)
    expect(r.total).toBe(r.contractual + r.late + r.kkdf + r.bsmv)
  })

  it('closes a December cycle into January with the right dates', () => {
    const account: CardAccount = {
      id: 'a',
      kind: 'card',
      name: 'Kart',
      limit: 5_000_000,
      available: 4_000_000,
      updatedAt: 0,
      createdAt: 0,
      lines: [
        {
          id: 'l',
          label: 'Kart',
          cutDay: 31,
          dueOffsetDays: 10,
          cycle: '2026-12',
          statementDebt: 1_000_000,
          minimumDue: 200_000,
          payment: 'unpaid',
        },
      ],
    }
    const closed = closeCycle(account.lines[0], account, d('2027-02-01'))
    expect(closed.cycle).toBe('2027-01')
    expect(closed.statementDebt).toBeNull()
    // Cut 31 Dec, due 10 Jan (Sunday) → 11 Jan, next cut 31 Jan: d1 = 11, d2 = 20.
    const expected = statementInterest({
      debt: 1_000_000,
      minimum: 200_000,
      paid: 0,
      cut: d('2026-12-31'),
      due: d('2027-01-11'),
      nextCut: d('2027-01-31'),
      rate,
    })
    expect(closed.interestHistory).toEqual([{ cycle: '2026-12', amount: expected.total, source: 'estimate' }])
  })
})
