import { addDays, daysBetween, formatLong, fromIso, startOfDay, toIso } from '../../domain/dates'
import { occurrences } from '../../domain/recurring'
import { nextCut, SOON_DAYS } from '../../domain/statement'
import type { StatementItem } from '../../domain/power'
import type { Account, CardAccount, IsoDate, Kurus, RecurringPayment } from '../../domain/types'

/** Pure calendar logic. No UI, no storage. Dates are local calendar days. */

export const TIMELINE_DAYS = 45

export interface PendingOccurrence {
  recurringId: string
  name: string
  accountId: string
  amount: Kurus
  date: Date
  iso: IsoDate
}

/**
 * Charges that are due (on or before today) and not yet handled. Handled means
 * on or before `handledThrough`; without it, the charge counts from startDate.
 * Sorted oldest first.
 */
export function pendingOccurrences(recurring: RecurringPayment[], today: Date): PendingOccurrence[] {
  const now = startOfDay(today)
  const out: PendingOccurrence[] = []
  for (const r of recurring) {
    if (!r.active) continue
    const from = r.handledThrough ? addDays(fromIso(r.handledThrough), 1) : fromIso(r.startDate)
    for (const date of occurrences(r, from, now)) {
      out.push({
        recurringId: r.id,
        name: r.name,
        accountId: r.accountId,
        amount: r.amount,
        date,
        iso: toIso(date),
      })
    }
  }
  return out.sort((a, b) => +a.date - +b.date || a.name.localeCompare(b.name, 'tr'))
}

/** Sum of the amounts of all active recurring payments (one charge each per month). */
export function monthlyRecurringTotal(recurring: RecurringPayment[]): Kurus {
  return recurring.reduce((sum, r) => (r.active ? sum + r.amount : sum), 0)
}

/** "Ayın 5. günü" — avoids Turkish suffix rules for the day number. */
export function dayOfMonthLabel(day: number): string {
  return `Ayın ${day}. günü`
}

export type TimelineKind = 'cut' | 'due' | 'recurring'

export type TimelineTarget = { type: 'statement'; accountId: string; lineIndex: number } | { type: 'recurring'; id: string }

export interface TimelineEvent {
  id: string
  kind: TimelineKind
  date: Date
  iso: IsoDate
  /** Owner account: its wallet colour marks the event. */
  accountId: string
  title: string
  /** Second line: "Asgari ödeme", "Tutar bekleniyor", or null. */
  detail: string | null
  /** Amount shown on the right, if known. A due date carries its outstanding minimum. */
  amount: Kurus | null
  /** The amount is an estimate (the minimum was not entered), so totals get a "~". */
  estimated: boolean
  /** Due within SOON_DAYS, or overdue. */
  soon: boolean
  target: TimelineTarget
}

const KIND_ORDER: Record<TimelineKind, number> = { cut: 0, due: 1, recurring: 2 }

/**
 * One date-sorted list of statement cuts, statement due dates (unpaid only) and
 * recurring charges within the next `days` days, counting today. Unpaid due
 * dates already passed are kept, so they show as overdue at the top.
 */
export function buildTimeline(
  accounts: Account[],
  statements: StatementItem[],
  recurring: RecurringPayment[],
  today: Date,
  days: number = TIMELINE_DAYS,
): TimelineEvent[] {
  const now = startOfDay(today)
  const horizon = addDays(now, days)
  const inWindow = (d: Date) => d >= now && d <= horizon
  const events: TimelineEvent[] = []
  const byId = new Map(accounts.map((a) => [a.id, a]))

  for (const account of accounts) {
    if (account.kind !== 'card') continue
    const card: CardAccount = account
    card.lines.forEach((line, lineIndex) => {
      const cut = nextCut(line.cutDay, now)
      if (!inWindow(cut)) return
      events.push({
        id: `cut:${card.id}:${lineIndex}:${toIso(cut)}`,
        kind: 'cut',
        date: cut,
        iso: toIso(cut),
        accountId: card.id,
        title: card.lines.length > 1 ? `${card.name} ${line.label} kesim` : `${card.name} kesim`,
        detail: 'Ekstre kesimi',
        amount: null,
        estimated: false,
        soon: false,
        target: { type: 'statement', accountId: card.id, lineIndex },
      })
    })
  }

  for (const item of statements) {
    if (item.view.status === 'paid') continue
    const overdue = item.view.status === 'overdue'
    if (!overdue && !inWindow(item.view.due)) continue
    const due = item.view.due
    const label = item.account.lines.length > 1 ? ` ${item.account.lines[item.lineIndex].label}` : ''
    const minimum = item.minimumOutstanding
    events.push({
      id: `due:${item.account.id}:${item.lineIndex}:${toIso(due)}`,
      kind: 'due',
      date: due,
      iso: toIso(due),
      accountId: item.account.id,
      title: `${item.account.name}${label} son ödeme`,
      detail: minimum != null ? 'Asgari ödeme' : 'Tutar bekleniyor',
      amount: minimum,
      estimated: minimum != null && item.minimumIsEstimate,
      soon: daysBetween(due, now) <= SOON_DAYS,
      target: { type: 'statement', accountId: item.account.id, lineIndex: item.lineIndex },
    })
  }

  for (const r of recurring) {
    for (const date of occurrences(r, now, horizon)) {
      events.push({
        id: `rec:${r.id}:${toIso(date)}`,
        kind: 'recurring',
        date,
        iso: toIso(date),
        accountId: r.accountId,
        title: r.name,
        detail: `Düzenli ödeme · ${byId.get(r.accountId)?.name ?? 'Hesap yok'}`,
        amount: r.amount,
        estimated: false,
        soon: false,
        target: { type: 'recurring', id: r.id },
      })
    }
  }

  return events.sort(
    (a, b) => +a.date - +b.date || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.title.localeCompare(b.title, 'tr'),
  )
}

export interface TimelineDay {
  iso: IsoDate
  label: string
  events: TimelineEvent[]
}

/** "Bugün", "Yarın" or "12 Ekim, Pazartesi". */
export function dayLabel(date: Date, today: Date): string {
  const diff = daysBetween(date, today)
  if (diff === 0) return 'Bugün'
  if (diff === 1) return 'Yarın'
  const weekday = new Intl.DateTimeFormat('tr-TR', { weekday: 'long' }).format(date)
  return `${formatLong(date)}, ${weekday.charAt(0).toLocaleUpperCase('tr-TR')}${weekday.slice(1)}`
}

/** Groups a date-sorted event list by calendar day, keeping order. */
export function groupByDay(events: TimelineEvent[], today: Date): TimelineDay[] {
  const days: TimelineDay[] = []
  for (const e of events) {
    const last = days[days.length - 1]
    if (last && last.iso === e.iso) last.events.push(e)
    else days.push({ iso: e.iso, label: dayLabel(e.date, today), events: [e] })
  }
  return days
}

export interface MoneyOut {
  total: Kurus
  /** At least one amount in the total is an estimate. */
  estimated: boolean
}

/** Exact kuruş sum of the known amounts. Events without an amount (kesim, unknown minimum) add nothing. */
export function sumAmounts(events: TimelineEvent[]): MoneyOut {
  let total = 0
  let estimated = false
  for (const e of events) {
    if (e.amount == null) continue
    total += e.amount
    if (e.estimated) estimated = true
  }
  return { total, estimated }
}

/** Known money out on one agenda day. */
export function dayTotal(day: TimelineDay): MoneyOut {
  return sumAmounts(day.events)
}

/**
 * Known money out over the whole agenda, with the number of payments and statement cuts in it.
 * `unknown` counts the due dates whose amount was not entered; they are not in `total`.
 */
export function periodSummary(days: TimelineDay[]): MoneyOut & { payments: number; cuts: number; unknown: number } {
  const events = days.flatMap((d) => d.events)
  const cuts = events.filter((e) => e.kind === 'cut').length
  const unknown = events.filter((e) => e.kind === 'due' && e.amount == null).length
  return { ...sumAmounts(events), payments: events.length - cuts, cuts, unknown }
}

export function accountName(accounts: Account[], id: string): string {
  return accounts.find((a) => a.id === id)?.name ?? 'Hesap yok'
}
