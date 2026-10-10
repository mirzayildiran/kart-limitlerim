import { cycleKeyOf, daysBetween, fromIso, formatShort, shiftMonth } from './dates'
import { projectedInterest } from './interest'
import { CURRENT_RATES } from './rates'
import { isCard, isKmh, limitHealth, outlook, statementItems, type StatementItem } from './power'
import { estimatedDueDate, nextCut, viewStatement } from './statement'
import { formatTL } from './money'
import type { InsightInput, Insight, InsightSeverity } from './insightsTypes'
import type { CardAccount, KmhAccount, Kurus } from './types'

/**
 * Rule-based budget suggestions. No AI here: every figure comes from the
 * domain helpers, and the text is plain Turkish addressed with "sen".
 */

const SEVERITY_RANK: Record<InsightSeverity, number> = { crit: 0, warn: 1, info: 2 }

/** Category increase only fires from this much spending this month. */
const CATEGORY_MIN_THIS_MONTH: Kurus = 50_000
/** This month must be at least 1.3× the same days last month. */
const CATEGORY_RATIO_NUM = 13
const CATEGORY_RATIO_DEN = 10
const CATEGORY_MAX = 3

/** Taxes on interest (KKDF + BSMV = 15% + 15%), applied on top of the rate. */
const TAX_FACTOR = 1.3

/** "Akbank" or, for a card with several lines, "Akbank Dijital". */
const lineName = (a: CardAccount, lineIndex: number): string =>
  a.lines.length > 1 ? `${a.name} ${a.lines[lineIndex].label}` : a.name

function cashShortfall(input: InsightInput): Insight[] {
  const o = outlook(input.accounts, input.recurring, input.today)
  if (o.cashAfter >= 0) return []
  const short = -o.cashAfter
  return [
    {
      id: 'cashShortfall',
      kind: 'cashShortfall',
      severity: 'crit',
      title: 'Kesime kadar nakit yetmeyebilir',
      body: `${formatShort(o.until)} kesimine kadar tahmini ${formatTL(short)} eksik kalabilir. Asgari ödemeler ve düzenli ödemeler eldeki nakit ve KMH ile karşılanamıyor.`,
      amount: short,
    },
  ]
}

function statementDue(input: InsightInput): Insight[] {
  const out: Insight[] = []
  for (const item of statementItems(input.accounts, input.today)) {
    const insight = statementDueInsight(item)
    if (insight) out.push(insight)
  }
  return out
}

function statementDueInsight(item: StatementItem): Insight | null {
  const { account, lineIndex, view, minimumOutstanding, minimumIsEstimate } = item
  if (minimumOutstanding == null || minimumOutstanding <= 0) return null

  let when: string
  let severity: InsightSeverity
  if (view.status === 'overdue') {
    when = 'gecikti'
    severity = 'crit'
  } else if (view.status === 'today') {
    when = 'bugün'
    severity = 'warn'
  } else if (view.status === 'soon') {
    when = `${view.daysLeft} gün sonra`
    severity = 'warn'
  } else {
    return null
  }

  const estimate = minimumIsEstimate ? ' (tahmini)' : ''
  return {
    id: `statementDue:${account.id}:${lineIndex}`,
    kind: 'statementDue',
    severity,
    title: `${lineName(account, lineIndex)} asgari ödemesi ${when}`,
    body: `Son ödeme ${formatShort(view.due)}. Ödenmemiş asgari tutar ${formatTL(minimumOutstanding)}${estimate}.`,
    amount: minimumOutstanding,
  }
}

function cardNearLimit(input: InsightInput): Insight[] {
  const out: Insight[] = []
  for (const a of input.accounts) {
    if (!isCard(a) && !isKmh(a)) continue
    const health = limitHealth(a)
    if (health === 'ok') continue
    const free = Math.max(0, a.available)
    out.push({
      id: `cardNearLimit:${a.id}`,
      kind: 'cardNearLimit',
      severity: 'warn',
      title: health === 'empty' ? `${a.name} limiti doldu` : `${a.name} limiti azalıyor`,
      body: `Boş limit ${formatTL(free)}, toplam limit ${formatTL(a.limit)}.`,
      amount: free,
    })
  }
  return out
}

function kmhInterest(input: InsightInput): Insight[] {
  const out: Insight[] = []
  for (const a of input.accounts.filter(isKmh)) {
    const used = a.limit - a.available
    if (used <= 0) continue
    const rate = a.rateOverride?.contractual ?? CURRENT_RATES.cash.contractual
    const daily = Math.round(((used * rate) / 100 / 30) * TAX_FACTOR)
    if (daily <= 0) continue
    out.push(kmhInterestInsight(a, used, daily))
  }
  return out
}

function kmhInterestInsight(a: KmhAccount, used: Kurus, daily: Kurus): Insight {
  return {
    id: `kmhInterest:${a.id}`,
    kind: 'kmhInterest',
    severity: 'warn',
    title: `${a.name} borcu faiz işletiyor`,
    body: `Kullandığın ${formatTL(used)} için günlük yaklaşık ${formatTL(daily)} faiz ve vergi işliyor (tahmini).`,
    amount: daily,
  }
}

function minimumInterest(input: InsightInput): Insight[] {
  const out: Insight[] = []
  for (const a of input.accounts.filter(isCard)) {
    a.lines.forEach((line, i) => {
      if (viewStatement(line, input.today).status === 'paid') return
      const projected = projectedInterest(a, i, input.today, 'minimum')
      if (!projected || projected.total <= 0) return
      out.push({
        id: `minimumInterest:${a.id}:${i}`,
        kind: 'minimumInterest',
        severity: 'info',
        title: `${lineName(a, i)} asgari ödeme faizi`,
        body: `Yalnızca asgariyi ödersen sonraki ekstreye tahmini ${formatTL(projected.total)} faiz yansır.`,
        amount: projected.total,
      })
    })
  }
  return out
}

function categoryIncrease(input: InsightInput): Insight[] {
  const { today } = input
  const thisKey = cycleKeyOf(today)
  const lastKey = shiftMonth(thisKey, -1)
  const dayNow = today.getDate()
  // Same day-span last month, clamped to last month's length (31 → 30 Sep).
  const lastLength = new Date(today.getFullYear(), today.getMonth(), 0).getDate()
  const lastSpan = Math.min(dayNow, lastLength)

  const totals = new Map<string, { thisMonth: Kurus; lastMonth: Kurus }>()
  for (const e of input.expenses) {
    const d = fromIso(e.date)
    const key = cycleKeyOf(d)
    const day = d.getDate()
    const t = totals.get(e.categoryId) ?? { thisMonth: 0, lastMonth: 0 }
    if (key === thisKey && day <= dayNow) t.thisMonth += e.amount
    else if (key === lastKey && day <= lastSpan) t.lastMonth += e.amount
    else continue
    totals.set(e.categoryId, t)
  }

  const candidates: { categoryId: string; name: string; thisMonth: Kurus; lastMonth: Kurus; diff: Kurus }[] = []
  for (const [categoryId, t] of totals) {
    if (t.thisMonth < CATEGORY_MIN_THIS_MONTH || t.lastMonth <= 0) continue
    // Integer comparison: thisMonth ≥ 1.3 × lastMonth.
    if (t.thisMonth * CATEGORY_RATIO_DEN < t.lastMonth * CATEGORY_RATIO_NUM) continue
    const name = input.categories.find((c) => c.id === categoryId)?.name ?? 'Diğer'
    candidates.push({ categoryId, name, ...t, diff: t.thisMonth - t.lastMonth })
  }

  candidates.sort((a, b) => b.diff - a.diff)
  return candidates.slice(0, CATEGORY_MAX).map((c) => {
    const pct = Math.round((c.diff / c.lastMonth) * 100)
    return {
      id: `categoryIncrease:${c.categoryId}`,
      kind: 'categoryIncrease',
      severity: 'warn',
      title: `${c.name} harcaması arttı`,
      body: `Bu ay ${formatTL(c.thisMonth)}, geçen ay aynı günlerde ${formatTL(c.lastMonth)}. Yaklaşık %${pct} daha fazla.`,
      amount: c.diff,
    }
  })
}

function bestCard(input: InsightInput): Insight[] {
  const { today } = input
  const cards = input.accounts.filter(
    (a): a is CardAccount => isCard(a) && a.available > 0 && a.lines.length > 0,
  )
  if (cards.length < 2) return []

  let best: { card: CardAccount; days: number; due: Date } | null = null
  for (const card of cards) {
    const line = card.lines[0]
    const due = estimatedDueDate(nextCut(line.cutDay, today), line.dueOffsetDays)
    const days = daysBetween(due, today)
    const better =
      !best || days > best.days || (days === best.days && card.available > best.card.available)
    if (better) best = { card, days, due }
  }
  if (!best) return []

  return [
    {
      id: `bestCard:${best.card.id}`,
      kind: 'bestCard',
      severity: 'info',
      title: `Bugünkü alışveriş için ${best.card.name}`,
      body: `Bugün yapacağın bir alışverişin tahmini son ödemesi ${formatShort(best.due)}, yani ${best.days} gün sonra. Boş limit ${formatTL(best.card.available)}.`,
      amount: best.card.available,
    },
  ]
}

/**
 * All rule-based insights for the current budget, most urgent first.
 * Within one severity the order follows the rule order below.
 */
export function computeInsights(input: InsightInput): Insight[] {
  const all = [
    ...cashShortfall(input),
    ...statementDue(input),
    ...cardNearLimit(input),
    ...kmhInterest(input),
    ...minimumInterest(input),
    ...categoryIncrease(input),
    ...bestCard(input),
  ]
  return all.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
}
