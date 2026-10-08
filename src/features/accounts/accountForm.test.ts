import { describe, it, expect } from 'vitest'
import { initFormState, validateForm, isFormValid, formStateToAccount, mergeLines, shouldWarnAvailable, type CardFormState, type KmhFormState, type BankFormState, type CashFormState } from './accountForm'
import type { CardAccount, CardLine, KmhAccount, BalanceAccount } from '../../domain/types'

describe('accountForm', () => {
  describe('initFormState', () => {
    it('creates empty card form', () => {
      const state = initFormState(undefined, 'card') as CardFormState
      expect(state.kind).toBe('card')
      expect(state.name).toBe('')
      expect(state.available).toBeNull()
      expect(state.limit).toBeNull()
      expect(state.lines).toHaveLength(1)
      expect(state.lines[0].label).toBe('Kredi kartı')
      expect(state.lines[0].cutDay).toBe('1')
      expect(state.lines[0].dueOffsetDays).toBe('10')
    })

    it('creates default cash form with name', () => {
      const state = initFormState(undefined, 'cash') as CashFormState
      expect(state.kind).toBe('cash')
      expect(state.name).toBe('Nakit')
      expect(state.balance).toBeNull()
    })

    it('loads existing card account', () => {
      const account: CardAccount = {
        id: 'acc1',
        kind: 'card',
        name: 'Akbank',
        available: 50000,
        limit: 100000,
        lines: [
          {
            id: 'line1',
            label: 'Ana Kart',
            cutDay: 15,
            dueOffsetDays: 10,
            subLimit: 20000,
            cycle: null,
            payment: 'unpaid',
            statementDebt: null,
            minimumDue: null,
            dueDate: null,
            paidAmount: null,
          },
        ],
        rateOverride: { contractual: 2.5, late: 3.0 },
        updatedAt: 100,
        createdAt: 50,
      }
      const state = initFormState(account, 'card') as CardFormState
      expect(state.kind).toBe('card')
      expect(state.name).toBe('Akbank')
      expect(state.available).toBe(50000)
      expect(state.limit).toBe(100000)
      expect(state.lines).toHaveLength(1)
      expect(state.lines[0].label).toBe('Ana Kart')
      expect(state.lines[0].cutDay).toBe('15')
      expect(state.lines[0].subLimit).toBe(20000)
      expect(state.contractualRate).toBe(2.5)
      expect(state.lateRate).toBe(3.0)
    })
  })

  describe('validateForm', () => {
    it('requires name', () => {
      const state = initFormState(undefined, 'card') as CardFormState
      state.name = ''
      const errors = validateForm(state)
      expect(errors.name).toBeTruthy()
    })

    it('validates card amounts', () => {
      const state = initFormState(undefined, 'card') as CardFormState
      state.available = -1
      state.limit = -1
      const errors = validateForm(state)
      expect(errors.available).toBeTruthy()
      expect(errors.limit).toBeTruthy()
    })

    it('validates card cutDay', () => {
      const state = initFormState(undefined, 'card') as CardFormState
      state.lines[0].cutDay = '32'
      let errors = validateForm(state)
      expect(errors.lines?.[0]?.cutDay).toBeTruthy()

      state.lines[0].cutDay = '0'
      errors = validateForm(state)
      expect(errors.lines?.[0]?.cutDay).toBeTruthy()

      state.lines[0].cutDay = '15'
      errors = validateForm(state)
      expect(errors.lines?.[0]?.cutDay).toBeFalsy()
    })

    it('validates card dueOffsetDays', () => {
      const state = initFormState(undefined, 'card') as CardFormState
      state.lines[0].dueOffsetDays = '0'
      let errors = validateForm(state)
      expect(errors.lines?.[0]?.dueOffsetDays).toBeTruthy()

      state.lines[0].dueOffsetDays = '31'
      errors = validateForm(state)
      expect(errors.lines?.[0]?.dueOffsetDays).toBeTruthy()

      state.lines[0].dueOffsetDays = '15'
      errors = validateForm(state)
      expect(errors.lines?.[0]?.dueOffsetDays).toBeFalsy()
    })

    it('requires at least one card line', () => {
      const state = initFormState(undefined, 'card') as CardFormState
      state.lines = []
      const errors = validateForm(state)
      expect(errors.lines?.[0]?._).toBeTruthy()
    })

    it('passes valid card form', () => {
      const state = initFormState(undefined, 'card') as CardFormState
      state.name = 'Akbank'
      state.available = 50000
      state.limit = 100000
      const errors = validateForm(state)
      expect(isFormValid(errors)).toBe(true)
    })

    it('validates KMH', () => {
      const state = initFormState(undefined, 'kmh') as KmhFormState
      state.name = 'KMH Hesabı'
      state.available = 30000
      state.limit = 50000
      const errors = validateForm(state)
      expect(isFormValid(errors)).toBe(true)
    })

    it('validates bank', () => {
      const state = initFormState(undefined, 'bank') as BankFormState
      state.name = 'Ziraat Bankası'
      state.balance = 100000
      const errors = validateForm(state)
      expect(isFormValid(errors)).toBe(true)
    })

    it('validates cash', () => {
      const state = initFormState(undefined, 'cash') as CashFormState
      state.balance = 5000
      const errors = validateForm(state)
      expect(isFormValid(errors)).toBe(true)
    })
  })

  describe('formStateToAccount', () => {
    it('converts card form to account', () => {
      const state = initFormState(undefined, 'card') as CardFormState
      state.name = 'Akbank'
      state.available = 50000
      state.limit = 100000
      state.lines[0].label = 'Ana Kart'
      state.lines[0].cutDay = '15'
      state.lines[0].dueOffsetDays = '10'
      state.lines[0].id = 'line_123'

      const account = formStateToAccount(state, 'acc_123', 1000)
      expect(account.kind).toBe('card')
      expect(account.id).toBe('acc_123')
      expect(account.name).toBe('Akbank')
      expect((account as CardAccount).available).toBe(50000)
      expect((account as CardAccount).limit).toBe(100000)
      expect(account.createdAt).toBe(1000)
      expect((account as CardAccount).lines).toHaveLength(1)
      expect((account as CardAccount).lines[0].label).toBe('Ana Kart')
      expect((account as CardAccount).lines[0].cutDay).toBe(15)
      expect((account as CardAccount).lines[0].payment).toBe('unpaid')
      expect((account as CardAccount).lines[0].cycle).toBeNull()
    })

    it('includes rate override when provided', () => {
      const state = initFormState(undefined, 'kmh') as KmhFormState
      state.name = 'KMH'
      state.available = 20000
      state.limit = 50000
      state.contractualRate = 3.5
      state.lateRate = 4.0

      const account = formStateToAccount(state, 'acc_123', 1000)
      expect((account as KmhAccount).rateOverride).toEqual({
        contractual: 3.5,
        late: 4.0,
      })
    })

    it('omits rate override when both are null', () => {
      const state = initFormState(undefined, 'kmh') as KmhFormState
      state.name = 'KMH'
      state.available = 20000
      state.limit = 50000

      const account = formStateToAccount(state, 'acc_123', 1000)
      expect((account as KmhAccount).rateOverride).toBeNull()
    })

    it('converts bank account', () => {
      const state = initFormState(undefined, 'bank') as BankFormState
      state.name = 'Ziraat Bankası'
      state.balance = 100000
      state.note = 'Havale hesabı'

      const account = formStateToAccount(state, 'acc_123', 1000) as BalanceAccount
      expect(account.kind).toBe('bank')
      expect(account.name).toBe('Ziraat Bankası')
      expect(account.balance).toBe(100000)
      expect(account.note).toBe('Havale hesabı')
    })

    it('converts cash account', () => {
      const state = initFormState(undefined, 'cash') as CashFormState
      state.balance = 5000

      const account = formStateToAccount(state, 'acc_123', 1000) as BalanceAccount
      expect(account.kind).toBe('cash')
      expect(account.name).toBe('Nakit')
      expect(account.balance).toBe(5000)
    })
  })

  describe('mergeLines', () => {
    const mockNewId = (prefix: string) => `${prefix}_test`
    const existingLine1: CardLine = {
      id: 'line1',
      label: 'Kart 1',
      cutDay: 15,
      dueOffsetDays: 10,
      subLimit: null,
      cycle: '2026-10',
      statementDebt: 50000,
      minimumDue: 10000,
      dueDate: '2026-10-25',
      payment: 'partial',
      paidAmount: 5000,
      interestCharged: 1200,
      interestHistory: [{ cycle: '2026-09', amount: 800, source: 'statement' }],
    }
    const existingLine2: CardLine = {
      id: 'line2',
      label: 'Kart 2',
      cutDay: 20,
      dueOffsetDays: 10,
      subLimit: 30000,
      cycle: '2026-10',
      statementDebt: 100000,
      minimumDue: 20000,
      dueDate: '2026-10-30',
      payment: 'unpaid',
      paidAmount: null,
      interestCharged: null,
      interestHistory: [],
    }

    it('preserves data when removing first line', () => {
      const edited = [
        { id: 'line2', label: 'Kart 2 Updated', cutDay: '21', dueOffsetDays: '10', subLimit: 30000 },
      ]
      const result = mergeLines([existingLine1, existingLine2], edited, mockNewId)

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('line2')
      expect(result[0].label).toBe('Kart 2 Updated')
      expect(result[0].cutDay).toBe(21)
      expect(result[0].statementDebt).toBe(100000)
      expect(result[0].payment).toBe('unpaid')
      expect(result[0].interestHistory).toEqual([])
    })

    it('preserves interest history when editing label', () => {
      const edited = [{ id: 'line1', label: 'Ana Kart', cutDay: '15', dueOffsetDays: '10', subLimit: null }]
      const result = mergeLines([existingLine1], edited, mockNewId)

      expect(result[0].label).toBe('Ana Kart')
      expect(result[0].statementDebt).toBe(50000)
      expect(result[0].payment).toBe('partial')
      expect(result[0].paidAmount).toBe(5000)
      expect(result[0].interestCharged).toBe(1200)
      expect(result[0].interestHistory).toEqual([{ cycle: '2026-09', amount: 800, source: 'statement' }])
    })

    it('generates id for new line', () => {
      const edited = [{ id: '', label: 'Yeni Kart', cutDay: '1', dueOffsetDays: '10', subLimit: null }]
      const result = mergeLines([], edited, mockNewId)

      expect(result[0].id).toBe('line_test')
      expect(result[0].cycle).toBeNull()
      expect(result[0].payment).toBe('unpaid')
      expect(result[0].interestHistory).toBeUndefined()
    })
  })

  describe('shouldWarnAvailable', () => {
    it('warns when available > limit', () => {
      expect(shouldWarnAvailable(60000, 50000)).toBe(true)
    })

    it('does not warn when available ≤ limit', () => {
      expect(shouldWarnAvailable(50000, 100000)).toBe(false)
      expect(shouldWarnAvailable(50000, 50000)).toBe(false)
    })

    it('does not warn when limit is 0', () => {
      expect(shouldWarnAvailable(60000, 0)).toBe(false)
    })

    it('does not warn with null values', () => {
      expect(shouldWarnAvailable(null, 50000)).toBe(false)
      expect(shouldWarnAvailable(60000, null)).toBe(false)
    })
  })
})
