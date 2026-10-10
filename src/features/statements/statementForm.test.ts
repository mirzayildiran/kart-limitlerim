import { describe, it, expect } from 'vitest'
import {
  initStatementFormState,
  validateStatementForm,
  isStatementFormValid,
  updateStatementLine,
  getMinimumHint,
  statementInterestPreview,
  minimumBelowEstimate,
  interestBoxTitle,
  type StatementFormState,
} from './statementForm'
import type { CardLine, CardAccount } from '../../domain/types'
import { viewStatement } from '../../domain/statement'

describe('statementForm', () => {
  const mockLine: CardLine = {
    id: 'line1',
    label: 'Kredi Kartı',
    cutDay: 15,
    dueOffsetDays: 10,
    subLimit: null,
    cycle: '2026-10',
    statementDebt: 50000,
    minimumDue: 10000,
    dueDate: '2026-10-25',
    payment: 'unpaid',
    paidAmount: null,
    interestCharged: null,
    interestHistory: undefined,
  }

  describe('initStatementFormState', () => {
    it('initializes from card line', () => {
      const state = initStatementFormState(mockLine)
      expect(state.statementDebt).toBe(50000)
      expect(state.minimumDue).toBe(10000)
      expect(state.dueDate).toBe('2026-10-25')
      expect(state.payment).toBe('unpaid')
      expect(state.paidAmount).toBeNull()
    })

    it('converts undefined values to null', () => {
      const line: CardLine = {
        ...mockLine,
        statementDebt: undefined,
        minimumDue: undefined,
        dueDate: undefined,
      }
      const state = initStatementFormState(line)
      expect(state.statementDebt).toBeNull()
      expect(state.minimumDue).toBeNull()
      expect(state.dueDate).toBeNull()
    })
  })

  describe('validateStatementForm', () => {
    it('accepts valid state', () => {
      const state: StatementFormState = {
        statementDebt: 50000,
        minimumDue: 10000,
        dueDate: '2026-10-25',
        payment: 'full',
        paidAmount: 50000,
        interestCharged: null,
      }
      const errors = validateStatementForm(state)
      expect(isStatementFormValid(errors)).toBe(true)
    })

    it('rejects negative debt', () => {
      const state: StatementFormState = {
        statementDebt: -100,
        minimumDue: 10000,
        dueDate: '2026-10-25',
        payment: 'unpaid',
        paidAmount: null,
        interestCharged: null,
      }
      const errors = validateStatementForm(state)
      expect(errors.statementDebt).toBeTruthy()
    })

    it('rejects negative minimum', () => {
      const state: StatementFormState = {
        statementDebt: 50000,
        minimumDue: -100,
        dueDate: '2026-10-25',
        payment: 'unpaid',
        paidAmount: null,
        interestCharged: null,
      }
      const errors = validateStatementForm(state)
      expect(errors.minimumDue).toBeTruthy()
    })

    it('requires paid amount when payment is partial', () => {
      const state: StatementFormState = {
        statementDebt: 50000,
        minimumDue: 10000,
        dueDate: '2026-10-25',
        payment: 'partial',
        paidAmount: null,
        interestCharged: null,
      }
      const errors = validateStatementForm(state)
      expect(errors.paidAmount).toBeTruthy()
    })

    it('rejects paid amount > debt', () => {
      const state: StatementFormState = {
        statementDebt: 50000,
        minimumDue: 10000,
        dueDate: '2026-10-25',
        payment: 'partial',
        paidAmount: 60000,
        interestCharged: null,
      }
      const errors = validateStatementForm(state)
      expect(errors.paidAmount).toBeTruthy()
    })

    it('allows null paid amount when payment is not partial', () => {
      const state: StatementFormState = {
        statementDebt: 50000,
        minimumDue: 10000,
        dueDate: '2026-10-25',
        payment: 'unpaid',
        paidAmount: null,
        interestCharged: null,
      }
      const errors = validateStatementForm(state)
      expect(errors.paidAmount).toBeUndefined()
    })

    it('rejects invalid date format', () => {
      const state: StatementFormState = {
        statementDebt: 50000,
        minimumDue: 10000,
        dueDate: '25-10-2026',
        payment: 'unpaid',
        paidAmount: null,
        interestCharged: null,
      }
      const errors = validateStatementForm(state)
      expect(errors.dueDate).toBeTruthy()
    })
  })

  describe('updateStatementLine', () => {
    it('updates line with form state', () => {
      const state: StatementFormState = {
        statementDebt: 100000,
        minimumDue: 20000,
        dueDate: '2026-10-28',
        payment: 'partial',
        paidAmount: 30000,
        interestCharged: null,
      }
      const updated = updateStatementLine(mockLine, state, '2026-10')
      expect(updated.statementDebt).toBe(100000)
      expect(updated.minimumDue).toBe(20000)
      expect(updated.dueDate).toBe('2026-10-28')
      expect(updated.payment).toBe('partial')
      expect(updated.paidAmount).toBe(30000)
      expect(updated.cycle).toBe('2026-10')
      // Preserved fields
      expect(updated.id).toBe(mockLine.id)
      expect(updated.label).toBe(mockLine.label)
      expect(updated.cutDay).toBe(mockLine.cutDay)
    })

    it('keeps paidAmount only for a partial payment', () => {
      const base: StatementFormState = {
        statementDebt: 100000,
        minimumDue: 20000,
        dueDate: null,
        payment: 'partial',
        paidAmount: 30000,
        interestCharged: null,
      }
      expect(updateStatementLine(mockLine, { ...base, payment: 'unpaid' }, '2026-10').paidAmount).toBeNull()
      expect(updateStatementLine(mockLine, { ...base, payment: 'minimum' }, '2026-10').paidAmount).toBeNull()
      expect(updateStatementLine(mockLine, { ...base, payment: 'full' }, '2026-10').paidAmount).toBeNull()
      expect(updateStatementLine(mockLine, base, '2026-10').paidAmount).toBe(30000)
    })
  })

  describe('minimumBelowEstimate', () => {
    // Limit 1.000 ₺ ≤ 100.000 ₺ → estimate is %20 of the debt.
    it('is false without a debt or a typed minimum', () => {
      expect(minimumBelowEstimate({ statementDebt: null, minimumDue: 100 }, 100000)).toBe(false)
      expect(minimumBelowEstimate({ statementDebt: 0, minimumDue: 0 }, 100000)).toBe(false)
      expect(minimumBelowEstimate({ statementDebt: 500000, minimumDue: null }, 100000)).toBe(false)
    })

    it('is true when the typed minimum is clearly under the estimate', () => {
      // 5.000 ₺ debt → estimate 1.000 ₺; 500 ₺ typed.
      expect(minimumBelowEstimate({ statementDebt: 500000, minimumDue: 50000 }, 100000)).toBe(true)
    })

    it('tolerates up to 1 ₺ of rounding and any higher minimum', () => {
      expect(minimumBelowEstimate({ statementDebt: 500000, minimumDue: 99900 }, 100000)).toBe(false)
      expect(minimumBelowEstimate({ statementDebt: 500000, minimumDue: 99899 }, 100000)).toBe(true)
      expect(minimumBelowEstimate({ statementDebt: 500000, minimumDue: 150000 }, 100000)).toBe(false)
    })

    it('uses the %40 ratio above a 100.000 ₺ limit', () => {
      // 5.000 ₺ debt on a 200.000 ₺ limit → estimate 2.000 ₺.
      expect(minimumBelowEstimate({ statementDebt: 500000, minimumDue: 150000 }, 20_000_000)).toBe(true)
    })
  })

  describe('interestBoxTitle', () => {
    it('names the scenario the figure was computed for', () => {
      expect(interestBoxTitle('unpaid')).toBe('Ödemezsen bu ekstrede işleyecek faiz')
      expect(interestBoxTitle('partial')).toBe('Kalanı ödemezsen bu ekstrede işleyecek faiz')
      expect(interestBoxTitle('minimum')).toBe('Yalnız asgariyi ödersen bu ekstrede işleyecek faiz')
    })
  })

  describe('getMinimumHint', () => {
    it('returns null for null debt', () => {
      expect(getMinimumHint(null, 100000)).toBeNull()
    })

    it('returns null for zero debt', () => {
      expect(getMinimumHint(0, 100000)).toBeNull()
    })

    it('returns hint for positive debt', () => {
      const hint = getMinimumHint(50000, 100000)
      expect(hint).toContain('Tahmini')
      expect(hint).toContain('₺')
      expect(hint).toContain('BDDK')
    })

    it('writes the BDDK ratios as Turkish percentages', () => {
      expect(getMinimumHint(500000, 100000)).toBe("Tahmini: 1.000 ₺ (BDDK: limit 100.000 ₺'ye kadar %20, üstü %40)")
    })

    it('includes estimate in hint', () => {
      // For a 50000 debt with 100000 limit (below threshold), estimate is 20% = 10000
      const hint = getMinimumHint(5000000, 100000)
      expect(hint).toBeTruthy()
      // Can't hardcode the exact value but can check format
      expect(hint).toMatch(/\d+/)
    })
  })

  describe('statementInterestPreview', () => {
    const mockAccount: CardAccount = {
      id: 'acc1',
      kind: 'card',
      name: 'Test Bank',
      available: 50000,
      limit: 100000,
      lines: [mockLine],
      rateOverride: null,
      updatedAt: 100,
      createdAt: 50,
    }

    it('returns none when debt is null', () => {
      const state: StatementFormState = {
        statementDebt: null,
        minimumDue: null,
        dueDate: null,
        payment: 'unpaid',
        paidAmount: null,
        interestCharged: null,
      }
      const view = viewStatement(mockLine, new Date(2026, 9, 8))
      const result = statementInterestPreview(state, mockAccount, view)
      expect(result.kind).toBe('none')
    })

    it('returns paidFull when payment is full', () => {
      const state: StatementFormState = {
        statementDebt: 50000,
        minimumDue: 10000,
        dueDate: '2026-10-25',
        payment: 'full',
        paidAmount: 50000,
        interestCharged: null,
      }
      const view = viewStatement(mockLine, new Date(2026, 9, 8))
      const result = statementInterestPreview(state, mockAccount, view)
      expect(result.kind).toBe('paidFull')
    })

    it('computes interest for unpaid with rateOverride', () => {
      const accountWithRate: CardAccount = {
        ...mockAccount,
        rateOverride: { contractual: 3.5, late: 3.8 },
      }
      const state: StatementFormState = {
        statementDebt: 100000,
        minimumDue: 40000,
        dueDate: '2026-10-25',
        payment: 'unpaid',
        paidAmount: null,
        interestCharged: null,
      }
      const view = viewStatement(mockLine, new Date(2026, 9, 8))
      const result = statementInterestPreview(state, accountWithRate, view)
      expect(result.kind).toBe('charge')
      if (result.kind === 'charge') {
        expect(result.total).toBeGreaterThan(0)
        expect(result.contractual).toBeGreaterThan(0)
        expect(result.rate).toBe(3.5)
        expect(result.minimumScenario).toBeGreaterThan(0)
        expect(result.minimumScenario).toBeLessThan(result.total)
      }
    })

    it('computes interest with partial payment', () => {
      const state: StatementFormState = {
        statementDebt: 50000,
        minimumDue: 10000,
        dueDate: '2026-10-25',
        payment: 'partial',
        paidAmount: 20000,
        interestCharged: null,
      }
      const view = viewStatement(mockLine, new Date(2026, 9, 8))
      const result = statementInterestPreview(state, mockAccount, view)
      expect(result.kind).toBe('charge')
      if (result.kind === 'charge') {
        expect(result.minimumScenario).toBeDefined()
      }
    })

    it('no minimumScenario when payment is minimum', () => {
      const state: StatementFormState = {
        statementDebt: 50000,
        minimumDue: 10000,
        dueDate: '2026-10-25',
        payment: 'minimum',
        paidAmount: 10000,
        interestCharged: null,
      }
      const view = viewStatement(mockLine, new Date(2026, 9, 8))
      const result = statementInterestPreview(state, mockAccount, view)
      expect(result.kind).toBe('charge')
      if (result.kind === 'charge') {
        expect(result.minimumScenario).toBeNull()
      }
    })
  })
})

describe('statementInterestPreview — bank example', () => {
  it('matches the published example: 1.000 ₺ debt, 400 ₺ minimum, nothing paid', () => {
    const line: CardLine = { id: 'l', label: 'Kart', cutDay: 10, dueOffsetDays: 10, cycle: '2026-01', payment: 'unpaid' }
    const account: CardAccount = {
      id: 'a',
      kind: 'card',
      name: 'Örnek',
      limit: 5_000_000,
      available: 0,
      lines: [line],
      rateOverride: { contractual: 3.5, late: 3.8 },
      updatedAt: 0,
      createdAt: 0,
    }
    const base = viewStatement(line, new Date(2026, 0, 15))
    // Bank example uses 10 days (cut → due) and 20 days (due → next cut).
    const view = { ...base, cut: new Date(2026, 0, 10), due: new Date(2026, 0, 20), nextCut: new Date(2026, 1, 9) }
    const state: StatementFormState = {
      statementDebt: 100_000,
      minimumDue: 40_000,
      dueDate: null,
      payment: 'unpaid',
      paidAmount: null,
      interestCharged: null,
    }
    const p = statementInterestPreview(state, account, view)
    expect(p.kind).toBe('charge')
    if (p.kind !== 'charge') return
    expect(p.contractual).toBe(2567)
    expect(p.late).toBe(1013)
    expect(p.contractual + p.late).toBe(3580)
    expect(p.taxes).toBe(1074) // 15% KKDF + 15% BSMV
    expect(p.total).toBe(4654)
    // The box names this scenario and the two rates behind the rows.
    expect(p.scenario).toBe('unpaid')
    expect(p.rate).toBe(3.5)
    expect(p.lateRate).toBe(3.8)
    // Paying only the 400 ₺ minimum: no late interest; 600 ₺ carried for 30 days at %3,5 → 2.100 + %30 tax.
    expect(p.minimumScenario).toBe(2730)
  })
})
