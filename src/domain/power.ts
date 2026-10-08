import { daysBetween } from './dates'
import { occurrences } from './recurring'
import { estimateMinimum } from './rates'
import { viewStatement, type StatementView } from './statement'
import type { Account, BalanceAccount, CardAccount, KmhAccount, Kurus, RecurringPayment } from './types'

/**
 * "Harcama gücü": what the user can actually spend right now, and what is
 * left once known obligations are paid. This is the app's core number.
 */

export interface PowerBreakdown {
  cards: Kurus
  kmh: Kurus
  liquid: Kurus
  total: Kurus
  cardLimit: Kurus
  kmhLimit: Kurus
  /** KMH balance in use (limit − available), which accrues daily interest. */
  kmhUsed: Kurus
}

export const isCard = (a: Account): a is CardAccount => a.kind === 'card'
export const isKmh = (a: Account): a is KmhAccount => a.kind === 'kmh'
export const isLiquid = (a: Account): a is BalanceAccount => a.kind === 'bank' || a.kind === 'cash'

const sum = <T>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + f(x), 0)

export function spendingPower(accounts: Account[]): PowerBreakdown {
  const cards = accounts.filter(isCard)
  const kmh = accounts.filter(isKmh)
  const liquid = accounts.filter(isLiquid)
  const c = sum(cards, (a) => Math.max(0, a.available))
  const k = sum(kmh, (a) => Math.max(0, a.available))
  // Negative cash would be a data-entry slip; never let it inflate debt here.
  const l = sum(liquid, (a) => Math.max(0, a.balance))
  return {
    cards: c,
    kmh: k,
    liquid: l,
    total: c + k + l,
    cardLimit: sum(cards, (a) => a.limit),
    kmhLimit: sum(kmh, (a) => a.limit),
    kmhUsed: sum(kmh, (a) => Math.max(0, a.limit - a.available)),
  }
}

/** Share of the limit still free, 0–1. */
export function freeRatio(a: CardAccount | KmhAccount): number {
  if (a.limit <= 0) return 0
  return Math.min(1, Math.max(0, a.available / a.limit))
}

export type LimitHealth = 'empty' | 'low' | 'ok'

export function limitHealth(a: CardAccount | KmhAccount): LimitHealth {
  if (a.available <= 0) return 'empty'
  return freeRatio(a) < 0.1 ? 'low' : 'ok'
}

/** Accounts sorted the way the user asked: most free first, larger limit breaks ties. */
export function byMostAvailable<T extends Account>(xs: T[]): T[] {
  const free = (a: Account) => (isLiquid(a) ? a.balance : a.available)
  const limit = (a: Account) => (isLiquid(a) ? 0 : a.limit)
  return [...xs].sort((a, b) => free(b) - free(a) || limit(b) - limit(a) || a.name.localeCompare(b.name, 'tr'))
}

export interface StatementItem {
  account: CardAccount
  lineIndex: number
  view: StatementView
  /** Amount still owed for this cycle's minimum; estimated when not entered. */
  minimumOutstanding: Kurus | null
  minimumIsEstimate: boolean
}

export function statementItems(accounts: Account[], today: Date): StatementItem[] {
  const items: StatementItem[] = []
  for (const account of accounts.filter(isCard)) {
    account.lines.forEach((line, lineIndex) => {
      const view = viewStatement(line, today)
      let minimum = view.minimumDue
      let estimate = false
      if (minimum == null && view.statementDebt != null) {
        minimum = estimateMinimum(view.statementDebt, account.limit)
        estimate = true
      }
      const outstanding =
        view.status === 'paid' ? 0 : minimum == null ? null : Math.max(0, minimum - (view.paidAmount ?? 0))
      items.push({ account, lineIndex, view, minimumOutstanding: outstanding, minimumIsEstimate: estimate })
    })
  }
  const rank = { overdue: 0, today: 1, soon: 2, upcoming: 3, paid: 4 } as const
  return items.sort((a, b) => rank[a.view.status] - rank[b.view.status] || +a.view.due - +b.view.due)
}

export interface Outlook {
  until: Date
  days: number
  /** Unpaid minimums due on or before `until` (known or estimated). */
  minimums: Kurus
  /** Statements due before `until` whose amount is still unknown. */
  unknownMinimums: number
  /** Recurring payments charged after today up to `until`, all sources. */
  recurring: Kurus
  recurringCount: number
  /** Part of `recurring` paid from cash, bank or KMH (not from a card). */
  recurringFromCash: Kurus
  /**
   * Spending power left once recurring payments are charged. Paying a card
   * minimum moves money from cash to the card's limit, so it does not change
   * this number — it changes `cashAfter`.
   */
  powerAfter: Kurus
  /** Cash + bank + free KMH available to pay obligations. */
  cashAvailable: Kurus
  /** cashAvailable − minimums − recurringFromCash. Negative = shortfall. */
  cashAfter: Kurus
}

/**
 * Look ahead to `until` (default: the nearest upcoming statement cut) and
 * account for what is already committed.
 */
export function outlook(
  accounts: Account[],
  recurring: RecurringPayment[],
  today: Date,
  until?: Date,
): Outlook {
  const items = statementItems(accounts, today)
  const horizon =
    until ??
    items.map((i) => i.view.nextCut).sort((a, b) => +a - +b)[0] ??
    new Date(today.getFullYear(), today.getMonth() + 1, today.getDate())

  let minimums = 0
  let unknown = 0
  for (const i of items) {
    if (i.view.status === 'paid' || i.view.due > horizon) continue
    if (i.minimumOutstanding == null) unknown++
    else minimums += i.minimumOutstanding
  }

  const byId = new Map(accounts.map((a) => [a.id, a]))
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
  let rec = 0
  let recCount = 0
  let recCash = 0
  for (const p of recurring) {
    const n = occurrences(p, tomorrow, horizon).length
    if (!n) continue
    rec += n * p.amount
    recCount += n
    if (byId.get(p.accountId)?.kind !== 'card') recCash += n * p.amount
  }

  const power = spendingPower(accounts)
  const cashAvailable = power.liquid + power.kmh
  return {
    until: horizon,
    days: Math.max(1, daysBetween(horizon, today)),
    minimums,
    unknownMinimums: unknown,
    recurring: rec,
    recurringCount: recCount,
    recurringFromCash: recCash,
    powerAfter: power.total - rec,
    cashAvailable,
    cashAfter: cashAvailable - minimums - recCash,
  }
}
