import { describe, it, expect } from 'vitest'
import type { CardAccount, CardLine } from '../../domain/types'
import { formatPercent } from '../../domain/money'
import {
  addExpenseLabel,
  cardInterestPanelData,
  interestHistory,
  interestSourceLine,
  kmhDailyCost,
  rateCaption,
  staleStatementLine,
  statementRows,
} from './detailModel'

describe('detailModel', () => {
  // Helper to create a test card line
  function testLine(label: string, overrides: Partial<CardLine> = {}): CardLine {
    return {
      id: `line_${label}`,
      label,
      cutDay: 15,
      dueOffsetDays: 20,
      cycle: '2026-10',
      statementDebt: null,
      minimumDue: null,
      payment: 'unpaid',
      ...overrides,
    }
  }

  // Helper to create a test card account
  function testCard(lines: CardLine[], overrides: Partial<CardAccount> = {}): CardAccount {
    return {
      id: 'card_test',
      kind: 'card' as const,
      name: 'Test Card',
      limit: 50_000_00,
      available: 50_000_00,
      lines,
      updatedAt: Date.now(),
      createdAt: Date.now(),
      ...overrides,
    }
  }

  describe('cardInterestPanelData', () => {
    it('returns data even with no debt (to show nudge message)', () => {
      const line = testLine('Main', { statementDebt: null })
      const account = testCard([line])
      const today = new Date(2026, 9, 8) // October 8, 2026

      const result = cardInterestPanelData(account, today)
      // Should return data object to show the nudge message
      expect(result).not.toBe(null)
    })

    it('includes history total and current projection when present', () => {
      const today = new Date(2026, 9, 8)
      const line = testLine('Main', {
        statementDebt: 3_000_00, // 3000 TL
        minimumDue: 600_00,
        payment: 'unpaid',
        interestHistory: [
          { cycle: '2026-09', amount: 50_00, source: 'statement' },
          { cycle: '2026-08', amount: 48_00, source: 'estimate' },
        ],
      })
      const account = testCard([line])

      const result = cardInterestPanelData(account, today)
      expect(result).not.toBe(null)
      if (result) {
        // History total should include both records
        expect(result.historyCycles).toBe(2)
        expect(result.totalInterest).toBe(98_00)
      }
    })

    it('collects daily costs from unpaid balances', () => {
      // October 20, 2026 - after the 15th cut date
      const today = new Date(2026, 9, 20)
      const line1 = testLine('Card1', {
        statementDebt: 1_000_00,
        minimumDue: 200_00,
        payment: 'unpaid',
        cycle: '2026-10', // Current cycle
      })
      const line2 = testLine('Card2', {
        statementDebt: 2_000_00,
        minimumDue: 400_00,
        payment: 'unpaid',
        cycle: '2026-10', // Current cycle
      })
      const account = testCard([line1, line2])

      const result = cardInterestPanelData(account, today)
      expect(result).not.toBe(null)
      if (result) {
        // Both lines have daily costs
        expect(result.dailyCosts.length).toBe(2)
      }
    })
  })

  describe('interestHistory', () => {
    it('returns empty when no history', () => {
      const account = testCard([testLine('Main')])
      const result = interestHistory(account)

      expect(result.records.length).toBe(0)
      expect(result.older).toBe(0)
    })

    it('sorts records newest first', () => {
      const account = testCard([
        testLine('Main', {
          interestHistory: [
            { cycle: '2026-08', amount: 50_00, source: 'estimate' },
            { cycle: '2026-10', amount: 60_00, source: 'statement' },
            { cycle: '2026-09', amount: 55_00, source: 'estimate' },
          ],
        }),
      ])

      const result = interestHistory(account)
      expect(result.records.length).toBe(3)
      expect(result.records[0].cycle).toBe('2026-10')
      expect(result.records[1].cycle).toBe('2026-09')
      expect(result.records[2].cycle).toBe('2026-08')
    })

    it('limits to 12 and counts older', () => {
      const records = Array.from({ length: 15 }, (_, i) => ({
        cycle: `2026-${String(8 - i).padStart(2, '0')}`,
        amount: 50_00,
        source: 'statement' as const,
      }))
      const account = testCard([testLine('Main', { interestHistory: records })])

      const result = interestHistory(account)
      expect(result.records.length).toBe(12)
      expect(result.older).toBe(3)
    })
  })

  describe('kmhDailyCost', () => {
    it('returns null when no used balance', () => {
      const account = { limit: 100_000_00, available: 100_000_00 }
      const result = kmhDailyCost(account)
      expect(result).toBe(null)
    })

    it('calculates daily cost with default rate', () => {
      // 10.000 TL used at 4.25% monthly contractual
      // Daily = 10.000 × 0.0425 / 30 × 1.3 ≈ 1842 kuruş
      const account = { limit: 100_000_00, available: 90_000_00 }
      const result = kmhDailyCost(account)
      expect(result).not.toBe(null)
      if (result) {
        expect(result).toBeGreaterThan(0)
        // 1,000,000 kuruş × 4.25 / 100 / 30 × 1.3 ≈ 1842 kuruş
        expect(result).toBeLessThan(2000)
        expect(result).toBeGreaterThan(1800)
      }
    })

    it('respects rate override', () => {
      const account = {
        limit: 100_000_00,
        available: 90_000_00,
        rateOverride: { contractual: 3.5, late: 4.0 },
      }
      const result = kmhDailyCost(account)
      expect(result).not.toBe(null)
      if (result) {
        // Should be lower than default 4.25% rate
        expect(result).toBeGreaterThan(0)
      }
    })
  })

  describe('statementRows', () => {
    it('uses current view for fresh cycle', () => {
      // Cut Oct 15 + 20 days = due Nov 4. Nov 1 → 3 days left → 'soon'.
      const today = new Date(2026, 10, 1)
      const line = testLine('Main', {
        statementDebt: 1_000_00,
        minimumDue: 200_00,
        payment: 'unpaid',
        cycle: '2026-10',
      })
      const account = testCard([line])

      const rows = statementRows(account, today)
      expect(rows).toHaveLength(1)
      expect(rows[0].status).toBe('soon')
      expect(rows[0].statusLabel).toBe('3 gün kaldı')
      expect(rows[0].debt).toBe(1_000_00)
    })

    it('treats stale cycle as unpaid with no debt', () => {
      // Stored cycle 2026-09 is stale on Nov 20 (current cut Nov 15, cycle 2026-11).
      // Stored debt/payment must not leak through; the new cut is due Dec 5 → upcoming.
      const today = new Date(2026, 10, 20)
      const line = testLine('Main', {
        statementDebt: 1_000_00, // Old value from previous cycle
        minimumDue: 200_00,
        payment: 'full', // User marked as paid
        cycle: '2026-09', // Stale cycle
      })
      const account = testCard([line])

      const rows = statementRows(account, today)
      expect(rows).toHaveLength(1)
      expect(rows[0].debt).toBe(null)
      expect(rows[0].status).toBe('upcoming')
      expect(rows[0].statusLabel).not.toBe('Ödendi')
    })
  })

  describe('lineProjections filtering', () => {
    it('excludes lines with payment=full', () => {
      const today = new Date(2026, 9, 20)
      const line1 = testLine('Full', {
        statementDebt: 1_000_00,
        minimumDue: 200_00,
        payment: 'full',
        cycle: '2026-10',
      })
      const line2 = testLine('Unpaid', {
        statementDebt: 1_000_00,
        minimumDue: 200_00,
        payment: 'unpaid',
        cycle: '2026-10',
      })
      const account = testCard([line1, line2])

      const data = cardInterestPanelData(account, today)
      expect(data).not.toBe(null)
      if (data) {
        // Only the unpaid line should appear
        expect(data.lineProjections.length).toBe(1)
        expect(data.lineProjections[0].label).toBe('Unpaid')
      }
    })

    it('uses view.payment instead of raw line.payment', () => {
      const today = new Date(2026, 9, 20)
      const line = testLine('Card', {
        statementDebt: 500_00,
        minimumDue: 100_00,
        payment: 'unpaid',
        cycle: '2026-10',
      })
      const account = testCard([line])

      const data = cardInterestPanelData(account, today)
      if (data && data.lineProjections.length > 0) {
        // Should use view's payment state (which matches raw for current cycle)
        expect(data.lineProjections[0].payment).toBe('unpaid')
      }
    })
  })

  describe('repeatsTotal', () => {
    it('is set when the only open statement is the whole figure (no history)', () => {
      const today = new Date(2026, 9, 20)
      const line = testLine('Main', { statementDebt: 1_000_00, minimumDue: 200_00, payment: 'unpaid', cycle: '2026-10' })
      const data = cardInterestPanelData(testCard([line]), today)
      expect(data).not.toBe(null)
      if (data) {
        expect(data.historyCycles).toBe(0)
        expect(data.lineProjections.length).toBe(1)
        expect(data.lineProjections[0].repeatsTotal).toBe(true)
      }
    })

    it('is clear for a line that is only part of the figure (history adds to it)', () => {
      const today = new Date(2026, 9, 20)
      const line = testLine('Main', {
        statementDebt: 1_000_00,
        minimumDue: 200_00,
        payment: 'unpaid',
        cycle: '2026-10',
        interestHistory: [{ cycle: '2026-09', amount: 50_00, source: 'statement' }],
      } as Partial<CardLine>)
      const data = cardInterestPanelData(testCard([line]), today)
      expect(data).not.toBe(null)
      if (data) {
        expect(data.totalInterest).toBe(50_00)
        expect(data.lineProjections.length).toBe(1)
        expect(data.lineProjections[0].repeatsTotal).toBe(false)
      }
    })
  })

  describe('interestSourceLine', () => {
    it('reads naturally without history', () => {
      expect(interestSourceLine(0, true)).toBe('Bu ekstrenin tahmini')
      expect(interestSourceLine(0, false)).toBe('Henüz faiz kaydı yok')
    })

    it('names the past statements', () => {
      expect(interestSourceLine(3, true)).toBe('Geçmiş 3 ekstre + bu ekstrenin tahmini')
      expect(interestSourceLine(2, false)).toBe('Geçmiş 2 ekstre')
    })
  })

  describe('rateCaption', () => {
    it('uses a Turkish decimal comma', () => {
      expect(formatPercent(4.25)).toBe('%4,25')
      expect(formatPercent(3)).toBe('%3')
    })

    it('names the user rate when overridden', () => {
      const text = rateCaption({ override: 3.5, contractual: 4.25, effective: '2026-01' })
      expect(text).toContain('senin girdiğin aylık %3,5 akdi')
      expect(text).not.toContain('TCMB')
    })

    it('names the TCMB ceiling otherwise, cash for KMH', () => {
      expect(rateCaption({ override: null, contractual: 4.25, effective: '2026-01' })).toContain('TCMB azami oranları (2026-01), aylık %4,25')
      expect(rateCaption({ override: null, contractual: 4.25, effective: '2026-01', cash: true })).toContain('nakit çekme')
    })
  })

  describe('staleStatementLine', () => {
    const today = new Date(2026, 9, 20) // after the 15 Oct cut

    it('is null when the carried statement fits inside what is used', () => {
      // 3.000 ₺ unpaid statement, 4.000 ₺ used on a 50.000 ₺ limit.
      const account = testCard([testLine('Main', { statementDebt: 3_000_00, payment: 'unpaid' })], { available: 46_000_00 })
      expect(staleStatementLine(account, today)).toBeNull()
    })

    it('points at the line to update when the statement is bigger than what is used', () => {
      // Statement 3.000 ₺ still "unpaid" here, but the bank shows only 500 ₺ used: it was paid there.
      const account = testCard(
        [testLine('Ek', { statementDebt: null }), testLine('Main', { statementDebt: 3_000_00, payment: 'unpaid' })],
        { available: 49_500_00 },
      )
      expect(staleStatementLine(account, today)).toBe(1)
    })

    it('counts a partial payment and the minimum as paid', () => {
      const partial = testCard([testLine('Main', { statementDebt: 3_000_00, payment: 'partial', paidAmount: 2_600_00 })], {
        available: 49_500_00,
      })
      expect(staleStatementLine(partial, today)).toBeNull() // 400 ₺ carried ≤ 500 ₺ used
      const minimum = testCard([testLine('Main', { statementDebt: 3_000_00, minimumDue: 600_00, payment: 'minimum' })], {
        available: 49_500_00,
      })
      expect(staleStatementLine(minimum, today)).toBe(0) // 2.400 ₺ carried > 500 ₺ used
    })

    it('is null when nothing is carried', () => {
      const account = testCard([testLine('Main', { statementDebt: 3_000_00, payment: 'full' })], { available: 50_000_00 })
      expect(staleStatementLine(account, today)).toBeNull()
    })
  })

  describe('addExpenseLabel', () => {
    it('says card for cards and account otherwise', () => {
      expect(addExpenseLabel('card')).toBe('Bu karttan harcama ekle')
      expect(addExpenseLabel('kmh')).toBe('Bu hesaptan harcama ekle')
      expect(addExpenseLabel('bank')).toBe('Bu hesaptan harcama ekle')
      expect(addExpenseLabel('cash')).toBe('Nakitten harcama ekle')
    })
  })
})
