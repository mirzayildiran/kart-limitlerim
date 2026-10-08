import { daysBetween, cycleKeyOf, fromIso, dayInMonth } from './dates'
import { estimateMinimum, INTEREST_TAXES, cardTierFor, CURRENT_RATES } from './rates'
import { viewStatement, lastCut, estimatedDueDate, rollToCurrentCycle } from './statement'
import type { CardAccount, CardLine, Kurus } from './types'

/**
 * Interest breakdown for a statement cycle.
 */
export interface InterestBreakdown {
  /** Contractual interest (period 1 + period 2) before taxes. */
  contractual: Kurus
  /** Late payment interest before taxes. */
  late: Kurus
  /** KKDF tax on interest. */
  kkdf: Kurus
  /** BSMV tax on interest. */
  bsmv: Kurus
  /** Total interest including taxes. */
  total: Kurus
  /** Days from cut to due (period 1). */
  days1: number
  /** Days from due to next cut (period 2). */
  days2: number
  /** Rate used: { contractual: %, late: % } */
  rate: { contractual: number; late: number }
}

/**
 * Calculate interest for a statement cycle.
 * Methodology: given debt D, minimum M, paid amount P, cut date C, due date U,
 * next cut N, rates a% (contractual) and g% (late):
 * - If P ≥ D → interest 0.
 * - Period 1 (C → U, d1 days): contractual interest on (D − P).
 * - Period 2 (U → N, d2 days): unpaidMin = max(0, M − P);
 *   late interest on unpaidMin; contractual interest on (D − P − unpaidMin).
 * - Taxes: KKDF 15% and BSMV 15% on interest.
 * - Round each component.
 */
export function statementInterest(input: {
  debt: Kurus
  minimum: Kurus
  paid: Kurus
  cut: Date
  due: Date
  nextCut: Date
  rate: { contractual: number; late: number }
}): InterestBreakdown {
  const { debt, minimum, paid, cut, due, nextCut, rate } = input

  // If paid >= debt, no interest
  if (paid >= debt) {
    const days1 = daysBetween(due, cut)
    const days2 = daysBetween(nextCut, due)
    return {
      contractual: 0,
      late: 0,
      kkdf: 0,
      bsmv: 0,
      total: 0,
      days1,
      days2,
      rate,
    }
  }

  const days1 = daysBetween(due, cut)
  const days2 = daysBetween(nextCut, due)

  // Period 1: contractual interest on (D - P)
  const outstanding = debt - paid
  const contractual1 = Math.round((outstanding * rate.contractual) / 100 / 30 * days1)

  // Period 2: unpaidMin = max(0, M - P)
  const unpaidMin = Math.max(0, minimum - paid)
  const late = Math.round((unpaidMin * rate.late) / 100 / 30 * days2)
  const stillOwed = outstanding - unpaidMin
  const contractual2 = Math.round((stillOwed * rate.contractual) / 100 / 30 * days2)

  const contractualTotal = contractual1 + contractual2
  const interestBeforeTax = contractualTotal + late

  // Taxes on total interest
  const kkdf = Math.round(interestBeforeTax * INTEREST_TAXES.kkdf)
  const bsmv = Math.round(interestBeforeTax * INTEREST_TAXES.bsmv)
  const total = interestBeforeTax + kkdf + bsmv

  return {
    contractual: contractualTotal,
    late,
    kkdf,
    bsmv,
    total,
    days1,
    days2,
    rate,
  }
}

/**
 * Get the rate for an account: use rateOverride if present, otherwise look up the tier.
 */
export function rateFor(account: CardAccount, debt: Kurus): { contractual: number; late: number } {
  if (account.rateOverride) {
    return account.rateOverride
  }
  const tier = cardTierFor(debt, CURRENT_RATES)
  return {
    contractual: tier.contractual,
    late: tier.late,
  }
}

/**
 * Project interest for a line in a given scenario.
 * Returns null when statementDebt is unknown.
 */
export function projectedInterest(
  account: CardAccount,
  lineIndex: number,
  today: Date,
  scenario: 'minimum' | 'none' | 'asEntered',
): InterestBreakdown | null {
  const line = account.lines[lineIndex]
  if (!line) return null

  const view = viewStatement(line, today)
  if (view.statementDebt == null) return null

  const debt = view.statementDebt
  let minimum = view.minimumDue
  if (minimum == null) {
    minimum = estimateMinimum(debt, account.limit)
  }

  const rate = rateFor(account, debt)

  // Determine paid amount based on scenario
  let paid: Kurus
  if (scenario === 'none') {
    paid = 0
  } else if (scenario === 'minimum') {
    paid = minimum
  } else {
    // 'asEntered': use the view's payment state
    if (view.payment === 'full') {
      paid = debt
    } else if (view.payment === 'minimum') {
      paid = minimum
    } else if (view.payment === 'partial') {
      paid = view.paidAmount ?? 0
    } else {
      // 'unpaid'
      paid = 0
    }
  }

  return statementInterest({
    debt,
    minimum,
    paid,
    cut: view.cut,
    due: view.due,
    nextCut: view.nextCut,
    rate,
  })
}

/**
 * Calculate the daily cost of carrying the current balance.
 * Returns interest + taxes that one day of the carried balance costs.
 * Returns null when carried balance <= 0 or debt unknown.
 */
export function dailyInterestCost(
  account: CardAccount,
  lineIndex: number,
  today: Date,
): Kurus | null {
  const line = account.lines[lineIndex]
  if (!line) return null

  const view = viewStatement(line, today)
  if (view.statementDebt == null) return null

  // Carried balance = debt - paid so far
  let paidSoFar: Kurus
  if (view.payment === 'full') {
    paidSoFar = view.statementDebt
  } else {
    paidSoFar = view.paidAmount ?? 0
  }

  const carried = view.statementDebt - paidSoFar
  if (carried <= 0) return null

  const rate = rateFor(account, view.statementDebt)
  // Daily cost: carried × a/100 / 30 × 1.30 (includes taxes)
  const value = Math.round(((carried * rate.contractual) / 100 / 30) * 1.3)
  return value
}

/**
 * Close a cycle: if the line's cycle differs from the current cycle,
 * append an InterestRecord for the old cycle and roll to the current cycle.
 */
export function closeCycle(line: CardLine, account: CardAccount, today: Date): CardLine {
  const currentCycle = cycleKeyOf(lastCut(line.cutDay, today))

  // If already on current cycle, nothing to do
  if (line.cycle === currentCycle) {
    return line
  }

  // Old cycle is different; record interest if there was debt and payment ≠ 'full'
  let updated = line
  if (line.cycle && line.statementDebt != null && line.statementDebt > 0 && line.payment !== 'full') {
    // Use interestCharged if present, else estimate
    let interestAmount: Kurus
    if (line.interestCharged != null) {
      interestAmount = line.interestCharged
    } else {
      // Estimate interest for the old cycle
      const oldCycle = line.cycle
      const [yearStr, monthStr] = oldCycle.split('-')
      const year = parseInt(yearStr, 10)
      const month = parseInt(monthStr, 10)
      const oldCutDate = dayInMonth(year, month - 1, line.cutDay)

      let oldDueDate: Date
      if (line.dueDate) {
        oldDueDate = fromIso(line.dueDate)
      } else {
        oldDueDate = estimatedDueDate(oldCutDate, line.dueOffsetDays)
      }

      const oldNextCutDate = dayInMonth(year, month, line.cutDay)

      // Determine paid amount in old cycle based on payment state
      // (we already know payment !== 'full' from the outer condition)
      let oldPaid: Kurus
      if (line.payment === 'minimum') {
        oldPaid = line.minimumDue ?? estimateMinimum(line.statementDebt, account.limit)
      } else if (line.payment === 'partial') {
        oldPaid = line.paidAmount ?? 0
      } else {
        // 'unpaid'
        oldPaid = 0
      }

      const rate = rateFor(account, line.statementDebt)
      const oldMinimum = line.minimumDue ?? estimateMinimum(line.statementDebt, account.limit)

      const breakdown = statementInterest({
        debt: line.statementDebt,
        minimum: oldMinimum,
        paid: oldPaid,
        cut: oldCutDate,
        due: oldDueDate,
        nextCut: oldNextCutDate,
        rate,
      })

      interestAmount = breakdown.total
    }

    // Append to history if not already there
    const history = line.interestHistory ?? []
    const alreadyRecorded = history.some((r) => r.cycle === line.cycle)
    if (!alreadyRecorded) {
      const newHistory = [
        ...history,
        {
          cycle: line.cycle,
          amount: interestAmount,
          source: line.interestCharged != null ? ('statement' as const) : ('estimate' as const),
        },
      ]
      updated = {
        ...updated,
        interestHistory: newHistory,
        interestCharged: null,
      }
    }
  }

  // Roll to current cycle; the printed interest belonged to the old statement.
  return rollToCurrentCycle({ ...updated, interestCharged: null }, today)
}

/**
 * Sum all interest from history and current projection.
 */
export function lifetimeInterest(
  account: CardAccount,
  today: Date,
): { total: Kurus; cycles: number; currentProjected: Kurus | null } {
  let historyTotal = 0
  let cycleCount = 0

  // Sum all interestHistory entries across all lines
  for (const line of account.lines) {
    const history = line.interestHistory ?? []
    for (const record of history) {
      historyTotal += record.amount
      cycleCount++
    }
  }

  // Sum the projection of every line whose statement is known; null only if none is.
  let currentProjectedTotal = 0
  let anyKnown = false
  for (let i = 0; i < account.lines.length; i++) {
    const projected = projectedInterest(account, i, today, 'asEntered')
    if (projected !== null) {
      anyKnown = true
      currentProjectedTotal += projected.total
    }
  }

  const currentProjected = anyKnown ? currentProjectedTotal : null

  return {
    total: historyTotal,
    cycles: cycleCount,
    currentProjected,
  }
}
