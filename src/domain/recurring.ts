import { dayInMonth, fromIso } from './dates'
import type { RecurringPayment } from './types'

/**
 * Charge dates of a recurring payment within [from, to] (inclusive), in order.
 * Count-limited payments are numbered from their start date.
 */
export function occurrences(p: RecurringPayment, from: Date, to: Date): Date[] {
  if (!p.active || to < from) return []
  const start = fromIso(p.startDate)
  const until = p.end.type === 'until' ? fromIso(p.end.date) : null
  const maxCount = p.end.type === 'count' ? p.end.count : Infinity

  const out: Date[] = []
  let index = 0
  let y = start.getFullYear()
  let m = start.getMonth()
  // Walk month by month from the start; bounded by `to` and the end rule.
  for (let guard = 0; guard < 1200; guard++, m++) {
    const d = dayInMonth(y, m, p.dayOfMonth)
    if (d > to) break
    if (until && d > until) break
    if (d < start) continue
    if (index >= maxCount) break
    index++
    if (d >= from) out.push(d)
  }
  return out
}

export function nextOccurrence(p: RecurringPayment, today: Date): Date | null {
  const horizon = new Date(today.getFullYear() + 2, today.getMonth(), today.getDate())
  return occurrences(p, today, horizon)[0] ?? null
}
