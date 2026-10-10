import { toIso } from './dates'
import { formatTL } from './money'
import { isCard, isKmh, outlook, spendingPower, statementItems, type StatementItem } from './power'
import type { BudgetSummary, Insight, InsightInput, SummaryAccount, SummaryCategory } from './insightsTypes'
import type { Account, Kurus } from './types'

/**
 * Builds the compact budget picture that is the only user data sent to a cloud
 * model (after consent). Never include individual expenses, notes, ids or
 * recurring payment names here: only totals, account names and formatted figures.
 */

const MAX_CATEGORIES = 8
const MAX_INSIGHTS = 10

export function budgetSummary(input: InsightInput, insights: Insight[]): BudgetSummary {
  const { accounts, today } = input
  const power = spendingPower(accounts)
  const o = outlook(accounts, input.recurring, today)
  const statements = statementItems(accounts, today)

  return {
    date: toIso(today),
    power: {
      total: formatTL(power.total),
      cards: formatTL(power.cards),
      kmh: formatTL(power.kmh),
      cash: formatTL(power.liquid),
    },
    outlook: {
      until: toIso(o.until),
      days: o.days,
      minimums: formatTL(o.minimums),
      unknownMinimums: o.unknownMinimums,
      recurring: formatTL(o.recurring),
      powerAfter: formatTL(o.powerAfter),
      cashAfter: formatTL(o.cashAfter),
      shortfall: o.cashAfter < 0,
    },
    accounts: orderAccounts(accounts).map((a) => summarizeAccount(a, statements)),
    categories: categoryComparison(input)
      .slice(0, MAX_CATEGORIES)
      .map(
        (c): SummaryCategory => ({
          name: c.name,
          thisMonth: formatTL(c.thisMonth),
          lastMonthSamePeriod: formatTL(c.lastMonthSamePeriod),
          changePercent:
            c.lastMonthSamePeriod === 0
              ? null
              : Math.round(((c.thisMonth - c.lastMonthSamePeriod) / c.lastMonthSamePeriod) * 100),
        }),
      ),
    insights: insights.slice(0, MAX_INSIGHTS).map((i) => ({ severity: i.severity, title: i.title, body: i.body })),
  }
}

/** Spending per category: this month up to today vs. the same days of last month. */
export function categoryComparison(
  input: InsightInput,
): { categoryId: string; name: string; thisMonth: Kurus; lastMonthSamePeriod: Kurus }[] {
  const { today } = input
  const thisPrefix = toIso(today).slice(0, 7)
  const thisDay = today.getDate()
  const lastPrefix = toIso(new Date(today.getFullYear(), today.getMonth() - 1, 1)).slice(0, 7)
  // Day 0 of this month is the last day of last month.
  const lastMonthLength = new Date(today.getFullYear(), today.getMonth(), 0).getDate()
  const lastDay = Math.min(thisDay, lastMonthLength)

  const totals = new Map<string, { thisMonth: Kurus; lastMonthSamePeriod: Kurus }>()
  for (const e of input.expenses) {
    const prefix = e.date.slice(0, 7)
    const day = Number(e.date.slice(8, 10))
    let window: 'thisMonth' | 'lastMonthSamePeriod' | null = null
    if (prefix === thisPrefix && day <= thisDay) window = 'thisMonth'
    else if (prefix === lastPrefix && day <= lastDay) window = 'lastMonthSamePeriod'
    if (!window) continue
    const t = totals.get(e.categoryId) ?? { thisMonth: 0, lastMonthSamePeriod: 0 }
    t[window] += e.amount
    totals.set(e.categoryId, t)
  }

  const names = new Map(input.categories.map((c) => [c.id, c.name]))
  return [...totals.entries()]
    .filter(([, t]) => t.thisMonth > 0 || t.lastMonthSamePeriod > 0)
    .map(([categoryId, t]) => ({
      categoryId,
      name: names.get(categoryId) ?? 'Diğer',
      thisMonth: t.thisMonth,
      lastMonthSamePeriod: t.lastMonthSamePeriod,
    }))
    .sort((a, b) => b.thisMonth - a.thisMonth)
}

/** Cards, then KMH, bank, cash. The sort is stable, so input order holds within a group. */
function orderAccounts(accounts: Account[]): Account[] {
  const rank = (a: Account) => (isCard(a) ? 0 : isKmh(a) ? 1 : a.kind === 'bank' ? 2 : 3)
  return [...accounts].sort((a, b) => rank(a) - rank(b))
}

function summarizeAccount(a: Account, statements: StatementItem[]): SummaryAccount {
  if (isCard(a)) {
    const summary: SummaryAccount = {
      name: a.name,
      kind: 'kart',
      available: formatTL(a.available),
      limit: formatTL(a.limit),
    }
    const mine = statements.filter((i) => i.account.id === a.id)
    // Nearest statement still open; if all are paid, the first line.
    const item =
      mine
        .filter((i) => i.view.status !== 'paid')
        .sort((x, y) => +x.view.due - +y.view.due)[0] ?? mine[0]
    if (item) {
      summary.nextCut = toIso(item.view.nextCut)
      summary.due = toIso(item.view.due)
      if (item.view.statementDebt != null) summary.statementDebt = formatTL(item.view.statementDebt)
      if (item.minimumOutstanding != null) summary.minimumOutstanding = formatTL(item.minimumOutstanding)
      summary.paid = item.view.status === 'paid'
    }
    return summary
  }
  if (isKmh(a)) {
    return { name: a.name, kind: 'KMH', available: formatTL(a.available), limit: formatTL(a.limit) }
  }
  return { name: a.name, kind: a.kind === 'bank' ? 'banka' : 'nakit', available: formatTL(a.balance) }
}
