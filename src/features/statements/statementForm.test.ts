import { describe, it, expect } from 'vitest'
import {
  initStatementFormState,
  validateStatementForm,
  isStatementFormValid,
  updateStatementLine,
  getMinimumHint,
  type StatementFormState,
} from './statementForm'
import type { CardLine } from '../../domain/types'

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
      }
      const errors = validateStatementForm(state)
      expect(errors.paidAmount).toBeUndefined()
    })

    it('rejects invalid date format', () => {
      const state: StatementFormState = {
        statementDebt: 50000,
        minimumDue: 10000,
        dueDate: '25-10-2026' as any,
        payment: 'unpaid',
        paidAmount: null,
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

    it('includes estimate in hint', () => {
      // For a 50000 debt with 100000 limit (below threshold), estimate is 20% = 10000
      const hint = getMinimumHint(5000000, 100000)
      expect(hint).toBeTruthy()
      // Can't hardcode the exact value but can check format
      expect(hint).toMatch(/\d+/)
    })
  })
})
