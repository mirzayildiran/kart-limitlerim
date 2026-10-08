/**
 * Pure form logic for statement editing.
 * Converts between form state and statement fields on a CardLine.
 */

import type { CardLine, CardAccount, Kurus, PaymentState, IsoDate } from '../../domain/types'
import { estimateMinimum } from '../../domain/rates'
import { formatTLExact } from '../../domain/money'
import { fromIso } from '../../domain/dates'
import { statementInterest, rateFor } from '../../domain/interest'
import type { StatementView } from '../../domain/statement'

export interface StatementFormState {
  statementDebt: Kurus | null
  minimumDue: Kurus | null
  dueDate: IsoDate | null
  payment: PaymentState
  paidAmount: Kurus | null
  interestCharged: Kurus | null
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
    interestCharged: line.interestCharged ?? null,
  }
}

export function validateStatementForm(state: StatementFormState): StatementFormErrors {
  const errors: StatementFormErrors = {}

  if (state.statementDebt !== null && state.statementDebt < 0) {
    errors.statementDebt = 'Tutar sıfırdan küçük olamaz.'
  }

  if (state.minimumDue !== null && state.minimumDue < 0) {
    errors.minimumDue = 'Tutar sıfırdan küçük olamaz.'
  }

  if (state.dueDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(state.dueDate)) {
    errors.dueDate = 'Geçerli tarih gir'
  }

  if (state.payment === 'partial') {
    if (state.paidAmount === null) {
      errors.paidAmount = 'Ödenen tutarı gir'
    } else if (state.paidAmount < 0) {
      errors.paidAmount = 'Tutar sıfırdan küçük olamaz.'
    } else if (state.statementDebt !== null && state.paidAmount > state.statementDebt) {
      errors.paidAmount = 'Ödenen tutar ekstre borcundan büyük olamaz.'
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
    interestCharged: state.interestCharged,
    interestHistory: line.interestHistory,
  }
}

export function getMinimumHint(debt: Kurus | null, cardLimit: Kurus): string | null {
  if (debt === null || debt <= 0) return null
  const estimate = estimateMinimum(debt, cardLimit)
  return `Tahmini: ${formatTLExact(estimate)} (BDDK: limit 100.000 ₺'ye kadar %20, üstü %40)`
}

/**
 * Compute interest preview for rendering the interest box in StatementSheet.
 */
export function statementInterestPreview(
  state: StatementFormState,
  account: CardAccount,
  view: StatementView,
): { kind: 'none' } | { kind: 'paidFull' } | { kind: 'charge'; total: Kurus; contractual: Kurus; late: Kurus; taxes: Kurus; rate: number; minimumScenario: Kurus | null } {
  const debt = state.statementDebt
  if (debt === null || debt <= 0) {
    return { kind: 'none' }
  }

  if (state.payment === 'full') {
    return { kind: 'paidFull' }
  }

  const dueDate = state.dueDate ? fromIso(state.dueDate) : view.due
  const minimum = state.minimumDue ?? estimateMinimum(debt, account.limit)
  const rate = rateFor(account, debt)

  // Determine paid for current scenario
  let paid: Kurus
  if (state.payment === 'unpaid') {
    paid = 0
  } else if (state.payment === 'minimum') {
    paid = minimum
  } else {
    // 'partial'
    paid = state.paidAmount ?? 0
  }

  const breakdown = statementInterest({
    debt,
    minimum,
    paid,
    cut: view.cut,
    due: dueDate,
    nextCut: view.nextCut,
    rate,
  })

  // Compute minimum scenario only for unpaid/partial
  let minimumScenario: Kurus | null = null
  if (state.payment === 'unpaid' || state.payment === 'partial') {
    const minBreakdown = statementInterest({
      debt,
      minimum,
      paid: minimum,
      cut: view.cut,
      due: dueDate,
      nextCut: view.nextCut,
      rate,
    })
    minimumScenario = minBreakdown.total
  }

  return {
    kind: 'charge',
    total: breakdown.total,
    contractual: breakdown.contractual,
    late: breakdown.late,
    taxes: breakdown.kkdf + breakdown.bsmv,
    rate: rate.contractual,
    minimumScenario,
  }
}
