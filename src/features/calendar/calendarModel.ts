import { addDays, daysBetween, formatLong, fromIso, startOfDay, toIso } from '../../domain/dates'
import { occurrences } from '../../domain/recurring'
import { nextCut, SOON_DAYS } from '../../domain/statement'
import type { StatementItem } from '../../domain/power'
import { formatTL } from '../../domain/money'
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
  title: string
  /** Second line: minimum due, "tutar bekleniyor", or the account name. */
  detail: string | null
  /** Amount shown on the right, if known. */
  amount: Kurus | null
  /** Due within SOON_DAYS: rendered in the warning colour. */
  soon: boolean
  target: TimelineTarget
}

const KIND_ORDER: Record<TimelineKind, number> = { cut: 0, due: 1, recurring: 2 }

/**
 * One date-sorted list of statement cuts, statement due dates (unpaid only) and
 * recurring charges within the next `days` days, counting today.
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
        title: card.lines.length > 1 ? `${card.name} ${line.label} kesim` : `${card.name} kesim`,
        detail: null,
        amount: null,
        soon: false,
        target: { type: 'statement', accountId: card.id, lineIndex },
      })
    })
  }

  for (const item of statements) {
    if (item.view.status === 'paid' || !inWindow(item.view.due)) continue
    const due = item.view.due
    const label = item.account.lines.length > 1 ? ` ${item.account.lines[item.lineIndex].label}` : ''
    events.push({
      id: `due:${item.account.id}:${item.lineIndex}:${toIso(due)}`,
      kind: 'due',
      date: due,
      iso: toIso(due),
      title: `${item.account.name}${label} son ödeme`,
      detail: item.minimumOutstanding != null ? `Asgari ${formatTL(item.minimumOutstanding)}` : 'tutar bekleniyor',
      amount: null,
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
        title: `${r.name} · ${byId.get(r.accountId)?.name ?? 'Hesap yok'}`,
        detail: null,
        amount: r.amount,
        soon: daysBetween(date, now) <= SOON_DAYS,
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

export function accountName(accounts: Account[], id: string): string {
  return accounts.find((a) => a.id === id)?.name ?? 'Hesap yok'
}
