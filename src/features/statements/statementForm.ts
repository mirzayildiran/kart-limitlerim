/**
 * Pure form logic for statement editing.
 * Converts between form state and statement fields on a CardLine.
 */

import type { CardLine, Kurus, PaymentState, IsoDate } from '../../domain/types'
import { estimateMinimum } from '../../domain/rates'
import { formatTLExact } from '../../domain/money'

export interface StatementFormState {
  statementDebt: Kurus | null
  minimumDue: Kurus | null
  dueDate: IsoDate | null
  payment: PaymentState
  paidAmount: Kurus | null
}

export interface StatementFormErrors {
  statementDebt?: string
  minimumDue?: string
  dueDate?: string
  paidAmount?: string
}

export function initStatementFormState(line: CardLine): StatementFormState {
  return {
    statementDebt: line.statementDebt ?? null,
    minimumDue: line.minimumDue ?? null,
    dueDate: line.dueDate ?? null,
    payment: line.payment,
    paidAmount: line.paidAmount ?? null,
  }
}

export function validateStatementForm(state: StatementFormState): StatementFormErrors {
  const errors: StatementFormErrors = {}

  if (state.statementDebt !== null && state.statementDebt < 0) {
    errors.statementDebt = 'Negatif olamaz'
  }

  if (state.minimumDue !== null && state.minimumDue < 0) {
    errors.minimumDue = 'Negatif olamaz'
  }

  if (state.dueDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(state.dueDate)) {
    errors.dueDate = 'Geçerli tarih gir'
  }

  if (state.payment === 'partial') {
    if (state.paidAmount === null) {
      errors.paidAmount = 'Ödenen tutarı gir'
    } else if (state.paidAmount < 0) {
      errors.paidAmount = 'Negatif olamaz'
    } else if (state.statementDebt !== null && state.paidAmount > state.statementDebt) {
      errors.paidAmount = 'Borçtan fazla olamazsınız'
    }
  }

  return errors
}

export function isStatementFormValid(errors: StatementFormErrors): boolean {
  return Object.keys(errors).length === 0
}

export function updateStatementLine(line: CardLine, state: StatementFormState, cycle: string): CardLine {
  return {
    ...line,
    cycle,
    statementDebt: state.statementDebt,
    minimumDue: state.minimumDue,
    dueDate: state.dueDate,
    payment: state.payment,
    paidAmount: state.paidAmount,
  }
}

export function getMinimumHint(debt: Kurus | null, cardLimit: Kurus): string | null {
  if (debt === null || debt <= 0) return null
  const estimate = estimateMinimum(debt, cardLimit)
  return `Tahmini: ${formatTLExact(estimate)} (BDDK: limit 100.000 ₺'ye kadar %20, üstü %40)`
}
