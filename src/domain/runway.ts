import { addDays, daysBetween } from './dates'
import { outlook, spendingPower, statementItems } from './power'
import { occurrences } from './recurring'
import type { Account, Kurus, RecurringPayment } from './types'

/**
 * Day-by-day view of spending power from today to the next statement cut.
 * Recurring charges lower it on the day they land; card minimums and cuts are
 * shown as markers but do not change it (paying a minimum moves cash, not limit).
 */

export type RunwayEventKind = 'recurring' | 'due' | 'cut'

export interface RunwayEvent {
  kind: RunwayEventKind
  label: string
  /** Charge or minimum still owed; null when unknown (cut, or minimum not entered). */
  amount: Kurus | null
}

export interface RunwayDay {
  date: Date
  /** Spending power at the end of this day. */
  power: Kurus
  events: RunwayEvent[]
}

export function runway(accounts: Account[], recurring: RecurringPayment[], today: Date): RunwayDay[] {
  const horizon = outlook(accounts, recurring, today).until
  const length = Math.max(1, daysBetween(horizon, today)) + 1
  const days: RunwayDay[] = Array.from({ length }, (_, i) => ({ date: addDays(today, i), power: 0, events: [] }))
  const indexOf = (d: Date) => daysBetween(d, today)

  const drop = new Array<number>(length).fill(0)
  const tomorrow = addDays(today, 1)
  for (const p of recurring) {
    for (const d of occurrences(p, tomorrow, horizon)) {
      const i = indexOf(d)
      drop[i] += p.amount
      days[i].events.push({ kind: 'recurring', label: p.name, amount: p.amount })
    }
  }

  for (const item of statementItems(accounts, today)) {
    const name = item.account.lines.length > 1 ? `${item.account.name} ${item.account.lines[item.lineIndex].label}` : item.account.name
    const due = indexOf(item.view.due)
    if (item.view.status !== 'paid' && due >= 0 && due < length) {
      days[due].events.push({ kind: 'due', label: `${name} son ödeme`, amount: item.minimumOutstanding })
    }
    const cut = indexOf(item.view.nextCut)
    if (cut >= 0 && cut < length) days[cut].events.push({ kind: 'cut', label: `${name} kesim`, amount: null })
  }

  let power = spendingPower(accounts).total
  for (let i = 0; i < length; i++) {
    power -= drop[i]
    days[i].power = power
  }
  return days
}
