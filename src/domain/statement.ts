import { addDays, cycleKeyOf, dayInMonth, daysBetween, fromIso, nextBusinessDay } from './dates'
import type { CardLine, CycleKey, Kurus, PaymentState } from './types'

/** Most recent statement cut on or before `today`. */
export function lastCut(cutDay: number, today: Date): Date {
  const thisMonth = dayInMonth(today.getFullYear(), today.getMonth(), cutDay)
  return thisMonth <= today ? thisMonth : dayInMonth(today.getFullYear(), today.getMonth() - 1, cutDay)
}

/** First statement cut strictly after `today`. */
export function nextCut(cutDay: number, today: Date): Date {
  const last = lastCut(cutDay, today)
  return dayInMonth(last.getFullYear(), last.getMonth() + 1, cutDay)
}

/** Estimated due date: cut + offset, moved off weekends. */
export function estimatedDueDate(cut: Date, offsetDays: number): Date {
  return nextBusinessDay(addDays(cut, offsetDays))
}

export type StatementStatus = 'paid' | 'upcoming' | 'soon' | 'today' | 'overdue'

export interface StatementView {
  cut: Date
  nextCut: Date
  cycle: CycleKey
  /** True when the stored statement fields belong to the current cycle. */
  current: boolean
  due: Date
  dueIsExact: boolean
  daysLeft: number
  cutToday: boolean
  statementDebt: Kurus | null
  minimumDue: Kurus | null
  payment: PaymentState
  paidAmount: Kurus | null
  status: StatementStatus
}

export const SOON_DAYS = 3

/**
 * Resolve a card line against today's date. Stored statement fields only count
 * when they belong to the latest cut; a new cut resets them to "unpaid, amount
 * unknown" until the user enters the new statement.
 */
export function viewStatement(line: CardLine, today: Date): StatementView {
  const cut = lastCut(line.cutDay, today)
  const cycle = cycleKeyOf(cut)
  const current = line.cycle === cycle
  const due = current && line.dueDate ? fromIso(line.dueDate) : estimatedDueDate(cut, line.dueOffsetDays)
  const daysLeft = daysBetween(due, today)
  const payment: PaymentState = current ? line.payment : 'unpaid'
  const settled = payment === 'minimum' || payment === 'full'

  let status: StatementStatus
  if (settled) status = 'paid'
  else if (daysLeft < 0) status = 'overdue'
  else if (daysLeft === 0) status = 'today'
  else if (daysLeft <= SOON_DAYS) status = 'soon'
  else status = 'upcoming'

  return {
    cut,
    nextCut: nextCut(line.cutDay, today),
    cycle,
    current,
    due,
    dueIsExact: current && !!line.dueDate,
    daysLeft,
    cutToday: daysBetween(today, cut) === 0,
    statementDebt: current ? line.statementDebt ?? null : null,
    minimumDue: current ? line.minimumDue ?? null : null,
    payment,
    paidAmount: current ? line.paidAmount ?? null : null,
    status,
  }
}

/** Return a copy of the line re-anchored on the current cycle (clears stale fields). */
export function rollToCurrentCycle(line: CardLine, today: Date): CardLine {
  const cycle = cycleKeyOf(lastCut(line.cutDay, today))
  if (line.cycle === cycle) return line
  return { ...line, cycle, statementDebt: null, minimumDue: null, dueDate: null, payment: 'unpaid', paidAmount: null }
}
