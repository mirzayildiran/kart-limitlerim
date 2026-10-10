import { describe, it, expect } from 'vitest'
import {
  statementInterest,
  rateFor,
  projectedInterest,
  dailyInterestCost,
  carriedStatementBalance,
  closeCycle,
  lifetimeInterest,
} from './interest'
import type { CardAccount, CardLine } from './types'

describe('interest calculations', () => {
  // Test data from Turkish bank examples
  // D = 1.000 ₺ (100000 kuruş), M = 400 ₺ (40000 kuruş)
  // Rate: { contractual: 3.5%, late: 3.8% }
  // Cut: 2026-01-10, Due: 2026-01-20 (10 days), NextCut: 2026-02-09 (20 days)

  const cut = new Date(2026, 0, 10) // Jan 10
  const due = new Date(2026, 0, 20) // Jan 20 (10 days later)
  const nextCut = new Date(2026, 1, 9) // Feb 9 (20 days later)
  const rate = { contractual: 3.5, late: 3.8 }

  describe('statementInterest bank examples', () => {
    it('paid = 400 ₺: contractual 2100 kuruş before tax', () => {
      const result = statementInterest({
        debt: 100000, // 1.000 ₺
        minimum: 40000, // 400 ₺
        paid: 40000, // 400 ₺ (exactly minimum)
        cut,
        due,
        nextCut,
        rate,
      })

      // Period 1: (100000 - 40000) * 3.5/100 / 30 * 10 = 60000 * 0.035 / 30 * 10 = 700
      // Period 2: unpaidMin = max(0, 40000 - 40000) = 0, late = 0
      //          stillOwed = 60000, contractual = 60000 * 3.5/100 / 30 * 20 = 1400
      // Total before tax = 700 + 1400 = 2100
      expect(result.contractual).toBe(2100)
      expect(result.late).toBe(0)
      expect(result.days1).toBe(10)
      expect(result.days2).toBe(20)
    })

    it('paid = 100 ₺: contractual 2450, late 760 kuruş before tax', () => {
      const result = statementInterest({
        debt: 100000, // 1.000 ₺
        minimum: 40000, // 400 ₺
        paid: 10000, // 100 ₺
        cut,
        due,
        nextCut,
        rate,
      })

      // Period 1: (100000 - 10000) * 3.5/100 / 30 * 10 = 90000 * 0.035 / 30 * 10 = 1050
      // Period 2: unpaidMin = max(0, 40000 - 10000) = 30000
      //          late = 30000 * 3.8/100 / 30 * 20 = 760
      //          stillOwed = 90000 - 30000 = 60000, contractual = 60000 * 3.5/100 / 30 * 20 = 1400
      // Total before tax = 1050 + 1400 + 760 = 3210
      expect(result.contractual).toBe(2450) // 1050 + 1400
      expect(result.late).toBe(760)
    })

    it('paid = 0: contractual 2567, late 1013 kuruş before tax', () => {
      const result = statementInterest({
        debt: 100000, // 1.000 ₺
        minimum: 40000, // 400 ₺
        paid: 0, // unpaid
        cut,
        due,
        nextCut,
        rate,
      })

      // Period 1: (100000 - 0) * 3.5/100 / 30 * 10 = 100000 * 0.035 / 30 * 10 = 1166.67 ≈ 1167
      // Period 2: unpaidMin = max(0, 40000 - 0) = 40000
      //          late = 40000 * 3.8/100 / 30 * 20 = 1013.33 ≈ 1013
      //          stillOwed = 100000 - 40000 = 60000, contractual = 60000 * 3.5/100 / 30 * 20 = 1400
      // Total before tax = 1167 + 1400 + 1013 = 3580
      expect(result.contractual).toBe(2567) // 1167 + 1400
      expect(result.late).toBe(1013)
    })
  })

  describe('interest taxes', () => {
    it('adds KKDF 15% and BSMV 15% to interest', () => {
      const result = statementInterest({
        debt: 100000,
        minimum: 40000,
        paid: 10000,
        cut,
        due,
        nextCut,
        rate,
      })

      const interestBeforeTax = result.contractual + result.late // 2450 + 760 = 3210
      const expectedKkdf = Math.round(interestBeforeTax * 0.15) // 3210 * 0.15 = 481.5 ≈ 482
      const expectedBsmv = Math.round(interestBeforeTax * 0.15) // 3210 * 0.15 = 481.5 ≈ 482
      const expectedTotal = interestBeforeTax + expectedKkdf + expectedBsmv

      expect(result.kkdf).toBe(expectedKkdf)
      expect(result.bsmv).toBe(expectedBsmv)
      expect(result.total).toBe(expectedTotal)
    })
  })

  describe('edge cases', () => {
    it('returns zero interest when paid >= debt', () => {
      const result = statementInterest({
        debt: 100000,
        minimum: 40000,
        paid: 100000,
        cut,
        due,
        nextCut,
        rate,
      })

      expect(result.contractual).toBe(0)
      expect(result.late).toBe(0)
      expect(result.kkdf).toBe(0)
      expect(result.bsmv).toBe(0)
      expect(result.total).toBe(0)
    })

    it('returns zero interest when paid > debt', () => {
      const result = statementInterest({
        debt: 100000,
        minimum: 40000,
        paid: 150000,
        cut,
        due,
        nextCut,
        rate,
      })

      expect(result.total).toBe(0)
    })
  })

  describe('rateFor', () => {
    it('uses rateOverride when present', () => {
      const account: CardAccount = {
        id: 'test',
        kind: 'card',
        name: 'Test',
        limit: 500000,
        available: 250000,
        lines: [],
        updatedAt: Date.now(),
        createdAt: Date.now(),
        rateOverride: { contractual: 2.5, late: 3.0 },
      }

      const rate = rateFor(account, 100000)
      expect(rate.contractual).toBe(2.5)
      expect(rate.late).toBe(3.0)
    })

    it('uses tier rate when no override', () => {
      const account: CardAccount = {
        id: 'test',
        kind: 'card',
        name: 'Test',
        limit: 500000,
        available: 250000,
        lines: [],
        updatedAt: Date.now(),
        createdAt: Date.now(),
      }

      // 29999 kuruş is 299.99 ₺, should be in tier 1 (< 30.000 ₺ = 3.000.000 kuruş)
      const rate1 = rateFor(account, 2999900)
      expect(rate1.contractual).toBe(3.25)
      expect(rate1.late).toBe(3.55)

      // 30.000 ₺ = 3.000.000 kuruş is the boundary (exclusive)
      // So 3.000.000 should be in tier 2
      const rate2 = rateFor(account, 3000000)
      expect(rate2.contractual).toBe(3.75)
      expect(rate2.late).toBe(4.05)
    })
  })

  describe('projectedInterest', () => {
    it('returns null when statementDebt is unknown', () => {
      const account: CardAccount = {
        id: 'test',
        kind: 'card',
        name: 'Test',
        limit: 500000,
        available: 250000,
        lines: [
          {
            id: 'line1',
            label: 'Main',
            cutDay: 10,
            dueOffsetDays: 10,
            cycle: '2026-01',
            payment: 'unpaid',
            // statementDebt is undefined
          },
        ],
        updatedAt: Date.now(),
        createdAt: Date.now(),
      }

      const today = new Date(2026, 0, 15)
      const result = projectedInterest(account, 0, today, 'asEntered')
      expect(result).toBeNull()
    })

    it('projects interest based on scenario', () => {
      const account: CardAccount = {
        id: 'test',
        kind: 'card',
        name: 'Test',
        limit: 500000,
        available: 250000,
        lines: [
          {
            id: 'line1',
            label: 'Main',
            cutDay: 10,
            dueOffsetDays: 10,
            cycle: '2026-01',
            statementDebt: 100000,
            minimumDue: 40000,
            payment: 'partial',
            paidAmount: 10000,
          },
        ],
        updatedAt: Date.now(),
        createdAt: Date.now(),
      }

      const today = new Date(2026, 0, 15)

      // 'none': paid = 0
      const none = projectedInterest(account, 0, today, 'none')
      expect(none).not.toBeNull()
      expect(none!.total).toBeGreaterThan(0)

      // 'minimum': paid = minimum
      const minimum = projectedInterest(account, 0, today, 'minimum')
      expect(minimum).not.toBeNull()
      expect(minimum!.total).toBeLessThan(none!.total)

      // 'asEntered': paid = paidAmount
      const asEntered = projectedInterest(account, 0, today, 'asEntered')
      expect(asEntered).not.toBeNull()
      expect(asEntered!.total).toBeLessThan(none!.total)
      expect(asEntered!.total).toBeGreaterThan(minimum!.total)
    })
  })

  describe('dailyInterestCost', () => {
    it('returns null when debt is unknown', () => {
      const account: CardAccount = {
        id: 'test',
        kind: 'card',
        name: 'Test',
        limit: 500000,
        available: 250000,
        lines: [
          {
            id: 'line1',
            label: 'Main',
            cutDay: 10,
            dueOffsetDays: 10,
            cycle: '2026-01',
            payment: 'unpaid',
          },
        ],
        updatedAt: Date.now(),
        createdAt: Date.now(),
      }

      const today = new Date(2026, 0, 15)
      const result = dailyInterestCost(account, 0, today)
      expect(result).toBeNull()
    })

    it('returns null when carried balance <= 0', () => {
      const account: CardAccount = {
        id: 'test',
        kind: 'card',
        name: 'Test',
        limit: 500000,
        available: 250000,
        lines: [
          {
            id: 'line1',
            label: 'Main',
            cutDay: 10,
            dueOffsetDays: 10,
            cycle: '2026-01',
            statementDebt: 100000,
            payment: 'full', // paid in full
          },
        ],
        updatedAt: Date.now(),
        createdAt: Date.now(),
      }

      const today = new Date(2026, 0, 15)
      const result = dailyInterestCost(account, 0, today)
      expect(result).toBeNull()
    })

    it('calculates daily cost including taxes (1.30 multiplier)', () => {
      const account: CardAccount = {
        id: 'test',
        kind: 'card',
        name: 'Test',
        limit: 500000,
        available: 250000,
        lines: [
          {
            id: 'line1',
            label: 'Main',
            cutDay: 10,
            dueOffsetDays: 10,
            cycle: '2026-01',
            statementDebt: 100000,
            minimumDue: 40000,
            payment: 'partial',
            paidAmount: 10000,
          },
        ],
        updatedAt: Date.now(),
        createdAt: Date.now(),
      }

      const today = new Date(2026, 0, 15)
      const result = dailyInterestCost(account, 0, today)

      expect(result).not.toBeNull()
      expect(result).toBeGreaterThan(0)

      // Verify it's using 1.30 multiplier
      // carried = 100000 - 10000 = 90000
      // For 100000 kuruş debt, tier is 3.25% (not override, not 3.5%)
      // daily = 90000 * 3.25 / 100 / 30 * 1.30 = 126.55 ≈ 127
      const carried = 100000 - 10000
      const tierRate = 3.25 // tier 1 rate for debt < 30.000 ₺
      const expected = Math.round(((carried * tierRate) / 100 / 30) * 1.3)
      expect(result).toBe(expected)
    })
  })

  describe('dailyInterestCost follows the payment state', () => {
    // Cut Jan 10, due Jan 20 (offset 10, a Tuesday), next cut Feb 10. Debt 1.000 ₺, minimum 400 ₺, tier 1 (%3,25 / %3,55).
    const card = (line: Partial<CardLine>): CardAccount => ({
      id: 'test',
      kind: 'card',
      name: 'Test',
      limit: 500000,
      available: 250000,
      lines: [{ id: 'line1', label: 'Main', cutDay: 10, dueOffsetDays: 10, cycle: '2026-01', statementDebt: 100000, minimumDue: 40000, payment: 'unpaid', ...line }],
      updatedAt: 0,
      createdAt: 0,
    })
    const beforeDue = new Date(2026, 0, 15)
    const afterDue = new Date(2026, 0, 25)
    const daily = (carriedContractual: number, carriedLate = 0) =>
      Math.round(((carriedContractual * 3.25 + carriedLate * 3.55) / 100 / 30) * 1.3)

    it('counts the minimum as paid when the state is "minimum" (was: whole debt)', () => {
      // Before the fix paidAmount (null) was read, so the whole 1.000 ₺ looked carried.
      expect(dailyInterestCost(card({ payment: 'minimum', paidAmount: null }), 0, beforeDue)).toBe(daily(60000))
    })

    it('uses the estimated minimum when none is stated', () => {
      // Limit 5.000 ₺ ≤ 100.000 ₺ → %20 of 1.000 ₺ = 200 ₺ paid.
      expect(dailyInterestCost(card({ payment: 'minimum', minimumDue: null }), 0, beforeDue)).toBe(daily(80000))
    })

    it('ignores a stale paidAmount when the state is "unpaid"', () => {
      expect(dailyInterestCost(card({ payment: 'unpaid', paidAmount: 30000 }), 0, beforeDue)).toBe(daily(100000))
    })

    it('charges the unpaid minimum at the late rate once the due date has passed', () => {
      // Unpaid: 400 ₺ of the minimum runs late, the other 600 ₺ contractual.
      expect(dailyInterestCost(card({ payment: 'unpaid' }), 0, afterDue)).toBe(daily(60000, 40000))
      // Partial 100 ₺: 300 ₺ of the minimum is still short.
      expect(dailyInterestCost(card({ payment: 'partial', paidAmount: 10000 }), 0, afterDue)).toBe(daily(60000, 30000))
      // Minimum paid: nothing runs late.
      expect(dailyInterestCost(card({ payment: 'minimum' }), 0, afterDue)).toBe(daily(60000))
    })

    it('carriedStatementBalance is debt minus what the state says was paid', () => {
      expect(carriedStatementBalance(card({ payment: 'unpaid', paidAmount: 30000 }), 0, beforeDue)).toBe(100000)
      expect(carriedStatementBalance(card({ payment: 'partial', paidAmount: 30000 }), 0, beforeDue)).toBe(70000)
      expect(carriedStatementBalance(card({ payment: 'minimum' }), 0, beforeDue)).toBe(60000)
      expect(carriedStatementBalance(card({ payment: 'full' }), 0, beforeDue)).toBe(0)
      expect(carriedStatementBalance(card({ statementDebt: null }), 0, beforeDue)).toBe(0)
      expect(carriedStatementBalance(card({}), 3, beforeDue)).toBe(0)
    })
  })

  describe('closeCycle', () => {
    it('returns same object when cycle is current', () => {
      const today = new Date(2026, 0, 15)
      const line: CardLine = {
        id: 'line1',
        label: 'Main',
        cutDay: 10,
        dueOffsetDays: 10,
        cycle: '2026-01', // current cycle
        statementDebt: 100000,
        payment: 'partial',
      }
      const account: CardAccount = {
        id: 'test',
        kind: 'card',
        name: 'Test',
        limit: 500000,
        available: 250000,
        lines: [line],
        updatedAt: Date.now(),
        createdAt: Date.now(),
      }

      const result = closeCycle(line, account, today)
      expect(result).toBe(line) // same object
    })

    it('appends interest record exactly once when closing cycle', () => {
      const today = new Date(2026, 1, 15) // Feb 15
      const line: CardLine = {
        id: 'line1',
        label: 'Main',
        cutDay: 10,
        dueOffsetDays: 10,
        cycle: '2026-01', // old cycle
        statementDebt: 100000,
        minimumDue: 40000,
        payment: 'partial',
        paidAmount: 10000,
      }
      const account: CardAccount = {
        id: 'test',
        kind: 'card',
        name: 'Test',
        limit: 500000,
        available: 250000,
        lines: [line],
        updatedAt: Date.now(),
        createdAt: Date.now(),
      }

      const closed = closeCycle(line, account, today)

      // Check that a record was appended for '2026-01'
      expect(closed.interestHistory).toBeDefined()
      expect(closed.interestHistory!.length).toBe(1)
      expect(closed.interestHistory![0].cycle).toBe('2026-01')
      expect(closed.interestHistory![0].source).toBe('estimate')
      expect(closed.interestHistory![0].amount).toBeGreaterThan(0)

      // Check that cycle was updated to current
      expect(closed.cycle).toBe('2026-02')

      // Check that interestCharged was cleared
      expect(closed.interestCharged).toBeNull()
    })

    it('uses interestCharged when present', () => {
      const today = new Date(2026, 1, 15)
      const line: CardLine = {
        id: 'line1',
        label: 'Main',
        cutDay: 10,
        dueOffsetDays: 10,
        cycle: '2026-01',
        statementDebt: 100000,
        minimumDue: 40000,
        payment: 'partial',
        paidAmount: 10000,
        interestCharged: 5000, // user-entered interest
      }
      const account: CardAccount = {
        id: 'test',
        kind: 'card',
        name: 'Test',
        limit: 500000,
        available: 250000,
        lines: [line],
        updatedAt: Date.now(),
        createdAt: Date.now(),
      }

      const closed = closeCycle(line, account, today)

      // Check that the recorded amount matches interestCharged
      expect(closed.interestHistory![0].amount).toBe(5000)
      expect(closed.interestHistory![0].source).toBe('statement')
    })

    it('does not append record if payment was full', () => {
      const today = new Date(2026, 1, 15)
      const line: CardLine = {
        id: 'line1',
        label: 'Main',
        cutDay: 10,
        dueOffsetDays: 10,
        cycle: '2026-01',
        statementDebt: 100000,
        payment: 'full', // paid in full
      }
      const account: CardAccount = {
        id: 'test',
        kind: 'card',
        name: 'Test',
        limit: 500000,
        available: 250000,
        lines: [line],
        updatedAt: Date.now(),
        createdAt: Date.now(),
      }

      const closed = closeCycle(line, account, today)

      // No interest history should be created
      expect(closed.interestHistory).toBeUndefined()
    })

    it('does not append record twice for the same cycle', () => {
      const today = new Date(2026, 1, 15)
      const line: CardLine = {
        id: 'line1',
        label: 'Main',
        cutDay: 10,
        dueOffsetDays: 10,
        cycle: '2026-01',
        statementDebt: 100000,
        minimumDue: 40000,
        payment: 'partial',
        paidAmount: 10000,
        interestHistory: [
          {
            cycle: '2026-01',
            amount: 5000,
            source: 'estimate',
          },
        ],
      }
      const account: CardAccount = {
        id: 'test',
        kind: 'card',
        name: 'Test',
        limit: 500000,
        available: 250000,
        lines: [line],
        updatedAt: Date.now(),
        createdAt: Date.now(),
      }

      const closed = closeCycle(line, account, today)

      // History should still have only 1 record
      expect(closed.interestHistory!.length).toBe(1)
    })
  })

  describe('lifetimeInterest', () => {
    it('sums all interest from history and current projection', () => {
      const today = new Date(2026, 2, 15) // March 15
      const account: CardAccount = {
        id: 'test',
        kind: 'card',
        name: 'Test',
        limit: 500000,
        available: 250000,
        lines: [
          {
            id: 'line1',
            label: 'Main',
            cutDay: 10,
            dueOffsetDays: 10,
            cycle: '2026-03',
            statementDebt: 100000,
            minimumDue: 40000,
            payment: 'partial',
            paidAmount: 10000,
            interestHistory: [
              { cycle: '2026-01', amount: 3000, source: 'estimate' },
              { cycle: '2026-02', amount: 3500, source: 'statement' },
            ],
          },
        ],
        updatedAt: Date.now(),
        createdAt: Date.now(),
      }

      const result = lifetimeInterest(account, today)

      // History sum = 3000 + 3500 = 6500
      expect(result.total).toBe(6500)
      expect(result.cycles).toBe(2)

      // Current projection should be calculated
      expect(result.currentProjected).toBeGreaterThan(0)
    })

    it('returns null for currentProjected when any line has unknown debt', () => {
      const today = new Date(2026, 2, 15)
      const account: CardAccount = {
        id: 'test',
        kind: 'card',
        name: 'Test',
        limit: 500000,
        available: 250000,
        lines: [
          {
            id: 'line1',
            label: 'Main',
            cutDay: 10,
            dueOffsetDays: 10,
            cycle: '2026-03',
            // statementDebt is unknown
            payment: 'unpaid',
            interestHistory: [{ cycle: '2026-02', amount: 2000, source: 'estimate' }],
          },
        ],
        updatedAt: Date.now(),
        createdAt: Date.now(),
      }

      const result = lifetimeInterest(account, today)

      expect(result.total).toBe(2000)
      expect(result.cycles).toBe(1)
      expect(result.currentProjected).toBeNull()
    })

    it('handles multiple lines correctly', () => {
      const today = new Date(2026, 2, 15)
      const account: CardAccount = {
        id: 'test',
        kind: 'card',
        name: 'Test',
        limit: 500000,
        available: 250000,
        lines: [
          {
            id: 'line1',
            label: 'Main',
            cutDay: 10,
            dueOffsetDays: 10,
            cycle: '2026-03',
            statementDebt: 100000,
            minimumDue: 40000,
            payment: 'partial',
            paidAmount: 10000,
            interestHistory: [
              { cycle: '2026-01', amount: 1000, source: 'estimate' },
              { cycle: '2026-02', amount: 1500, source: 'statement' },
            ],
          },
          {
            id: 'line2',
            label: 'Secondary',
            cutDay: 15,
            dueOffsetDays: 10,
            cycle: '2026-03',
            statementDebt: 50000,
            minimumDue: 10000,
            payment: 'partial',
            paidAmount: 5000,
            interestHistory: [
              { cycle: '2026-02', amount: 800, source: 'estimate' },
            ],
          },
        ],
        updatedAt: Date.now(),
        createdAt: Date.now(),
      }

      const result = lifetimeInterest(account, today)

      // History sum = 1000 + 1500 + 800 = 3300
      expect(result.total).toBe(3300)
      expect(result.cycles).toBe(3)

      // Current projection should include both lines
      expect(result.currentProjected).toBeGreaterThan(0)
    })
  })
})

describe('review regressions', () => {
  const base = (lines: CardLine[]): CardAccount => ({
    id: 'acc',
    kind: 'card',
    name: 'Örnek Banka',
    limit: 2_000_000,
    available: 1_000_000,
    lines,
    updatedAt: 0,
    createdAt: 0,
  })

  it('closeCycle clears printed interest even when the old statement was paid in full', () => {
    const line: CardLine = {
      id: 'l1',
      label: 'Kart',
      cutDay: 10,
      dueOffsetDays: 10,
      cycle: '2026-01',
      statementDebt: 100_000,
      payment: 'full',
      interestCharged: 1_234,
    }
    const closed = closeCycle(line, base([line]), new Date(2026, 1, 15))
    expect(closed.cycle).toBe('2026-02')
    expect(closed.interestCharged).toBeNull()
    expect(closed.interestHistory ?? []).toHaveLength(0)
  })

  it('lifetimeInterest projects known lines even when another line is unknown', () => {
    const known: CardLine = {
      id: 'l1',
      label: 'Ana kart',
      cutDay: 10,
      dueOffsetDays: 10,
      cycle: '2026-03',
      statementDebt: 100_000,
      minimumDue: 40_000,
      payment: 'unpaid',
    }
    const unknown: CardLine = { id: 'l2', label: 'Dijital kart', cutDay: 12, dueOffsetDays: 10, cycle: '2026-03', payment: 'unpaid' }
    const acc = base([known, unknown])
    const today = new Date(2026, 2, 15)
    const single = projectedInterest(acc, 0, today, 'asEntered')!
    expect(lifetimeInterest(acc, today).currentProjected).toBe(single.total)
  })
})
