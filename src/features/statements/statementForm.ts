/**
 * Pure form logic for statement editing.
 * Converts between form state and statement fields on a CardLine.
 */

import type { CardLine, CardAccount, Kurus, PaymentState, IsoDate } from '../../domain/types'
import { estimateMinimum, MINIMUM_RULE } from '../../domain/rates'
import { formatPercent, formatTL, formatTLExact } from '../../domain/money'
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

/**
 * Write the form onto the line. `paidAmount` is kept only for a partial payment: the
 * other states say what was paid on their own, and a figure left over from an earlier
 * "Kısmi" must not be read later (it used to shrink the daily interest of an unpaid card).
 */
export function updateStatementLine(line: CardLine, state: StatementFormState, cycle: string): CardLine {
  return {
    ...line,
    cycle,
    statementDebt: state.statementDebt,
    minimumDue: state.minimumDue,
    dueDate: state.dueDate,
    payment: state.payment,
    paidAmount: state.payment === 'partial' ? state.paidAmount : null,
    interestCharged: state.interestCharged,
    interestHistory: line.interestHistory,
  }
}

export function getMinimumHint(debt: Kurus | null, cardLimit: Kurus): string | null {
  if (debt === null || debt <= 0) return null
  const estimate = estimateMinimum(debt, cardLimit)
  const r = MINIMUM_RULE
  return `Tahmini: ${formatTLExact(estimate)} (BDDK: limit ${formatTL(r.threshold)}'ye kadar ${formatPercent(r.lowRatio * 100)}, üstü ${formatPercent(r.highRatio * 100)})`
}

/** Below this gap (1 ₺) a lower minimum is treated as rounding, not as a typo. */
const MINIMUM_TOLERANCE: Kurus = 100

/**
 * True when the typed minimum is clearly lower than the BDDK estimate in the hint.
 * Banks can print a higher minimum (interest, overdue amounts) but rarely a lower one,
 * so a lower figure is worth a second look at the statement. Says nothing beyond that.
 */
export function minimumBelowEstimate(state: Pick<StatementFormState, 'statementDebt' | 'minimumDue'>, cardLimit: Kurus): boolean {
  const debt = state.statementDebt
  if (debt === null || debt <= 0 || state.minimumDue === null) return false
  return state.minimumDue < estimateMinimum(debt, cardLimit) - MINIMUM_TOLERANCE
}

/**
 * Title of the interest box, naming the scenario the figure was computed for
 * (the paid amount statementInterestPreview used): nothing, the part paid so far, or the minimum.
 */
export function interestBoxTitle(payment: Exclude<PaymentState, 'full'>): string {
  if (payment === 'minimum') return 'Yalnız asgariyi ödersen bu ekstrede işleyecek faiz'
  if (payment === 'partial') return 'Kalanı ödemezsen bu ekstrede işleyecek faiz'
  return 'Ödemezsen bu ekstrede işleyecek faiz'
}

export type StatementInterestPreview =
  | { kind: 'none' }
  | { kind: 'paidFull' }
  | {
      kind: 'charge'
      /** Which paid amount the figures assume (unpaid → 0, partial → paidAmount, minimum → minimum). */
      scenario: Exclude<PaymentState, 'full'>
      total: Kurus
      contractual: Kurus
      late: Kurus
      taxes: Kurus
      /** Monthly contractual rate (%). */
      rate: number
      /** Monthly late rate (%). */
      lateRate: number
      minimumScenario: Kurus | null
    }

/**
 * Compute interest preview for rendering the interest box in StatementSheet.
 */
export function statementInterestPreview(
  state: StatementFormState,
  account: CardAccount,
  view: StatementView,
): StatementInterestPreview {
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
    scenario: state.payment,
    total: breakdown.total,
    contractual: breakdown.contractual,
    late: breakdown.late,
    taxes: breakdown.kkdf + breakdown.bsmv,
    rate: rate.contractual,
    lateRate: rate.late,
    minimumScenario,
  }
}
