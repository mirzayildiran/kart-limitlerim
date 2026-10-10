import { cycleKeyOf, shiftMonth } from './dates'
import type { BudgetStatus } from './insightsTypes'
import type { Category, CategoryBudget, Expense, Kurus } from './types'

/**
 * Month-to-date spending and the month-end estimate built from it. Every
 * projection is a tahmini: it assumes the daily pace so far holds.
 */

/** Days from the start of the month before a pace check counts as meaningful. */
export const PACE_MIN_DAYS = 7

export interface MonthPace {
  /** Spent this month, day 1 through today. */
  spent: Kurus
  /** Last month, day 1 through the same day (clamped to its length). */
  lastMonthSamePeriod: Kurus
  /** All of last month. */
  lastMonthTotal: Kurus
  /** Estimated month-end total at the current daily pace (tahmini). */
  projected: Kurus
  daysPassed: number
  daysInMonth: number
}

export interface BudgetRow {
  categoryId: string
  name: string
  monthly: Kurus
  spent: Kurus
  /** Negative when over the target. */
  remaining: Kurus
  /** Whole percent of the target used so far. */
  usedPercent: number
  /** Estimated month-end spend in this category (tahmini). */
  projected: Kurus
  status: BudgetStatus
}

const STATUS_RANK: Record<BudgetStatus, number> = { over: 0, pace: 1, near: 2, ok: 3 }

/** Expense dates are "YYYY-MM-DD": month key and day of month, read without a Date. */
function dayOf(date: string): number {
  return Number(date.slice(8, 10))
}

function projectedOf(spent: Kurus, daysPassed: number, daysInMonth: number): Kurus {
  return Math.round((spent / daysPassed) * daysInMonth)
}

function daysInMonthOf(today: Date): number {
  return new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
}

/** Spending this month up to today, per category. Future-dated expenses are left out. */
function thisMonthByCategory(expenses: Expense[], today: Date): Map<string, Kurus> {
  const key = cycleKeyOf(today)
  const dayNow = today.getDate()
  const totals = new Map<string, Kurus>()
  for (const e of expenses) {
    if (e.date.slice(0, 7) !== key || dayOf(e.date) > dayNow) continue
    totals.set(e.categoryId, (totals.get(e.categoryId) ?? 0) + e.amount)
  }
  return totals
}

export function monthPace(expenses: Expense[], today: Date): MonthPace {
  const thisKey = cycleKeyOf(today)
  const lastKey = shiftMonth(thisKey, -1)
  const daysPassed = today.getDate()
  const daysInMonth = daysInMonthOf(today)
  // Day 0 of this month is the last day of last month.
  const lastLength = new Date(today.getFullYear(), today.getMonth(), 0).getDate()
  const lastSpan = Math.min(daysPassed, lastLength)

  let spent = 0
  let lastMonthSamePeriod = 0
  let lastMonthTotal = 0
  for (const e of expenses) {
    const key = e.date.slice(0, 7)
    const day = dayOf(e.date)
    if (key === thisKey) {
      if (day <= daysPassed) spent += e.amount
    } else if (key === lastKey) {
      lastMonthTotal += e.amount
      if (day <= lastSpan) lastMonthSamePeriod += e.amount
    }
  }

  return {
    spent,
    lastMonthSamePeriod,
    lastMonthTotal,
    projected: projectedOf(spent, daysPassed, daysInMonth),
    daysPassed,
    daysInMonth,
  }
}

function statusOf(spent: Kurus, monthly: Kurus, projected: Kurus, daysPassed: number): BudgetStatus {
  if (spent > monthly) return 'over'
  if (daysPassed >= PACE_MIN_DAYS && projected > monthly) return 'pace'
  // Integer comparison: spent ≥ 80% of monthly.
  if (spent * 10 >= monthly * 8) return 'near'
  return 'ok'
}

/**
 * One row per budget whose category still exists, most urgent first: over,
 * then pace, near, ok; within a status the highest used percent first.
 */
export function budgetProgress(
  expenses: Expense[],
  budgets: CategoryBudget[],
  categories: Category[],
  today: Date,
): BudgetRow[] {
  const daysPassed = today.getDate()
  const daysInMonth = daysInMonthOf(today)
  const spentBy = thisMonthByCategory(expenses, today)
  const names = new Map(categories.map((c) => [c.id, c.name]))

  const rows: BudgetRow[] = []
  for (const b of budgets) {
    const name = names.get(b.categoryId)
    // A target for a deleted category, or a non-positive one, has nothing to show.
    if (name === undefined || b.monthly <= 0) continue
    const spent = spentBy.get(b.categoryId) ?? 0
    const projected = projectedOf(spent, daysPassed, daysInMonth)
    rows.push({
      categoryId: b.categoryId,
      name,
      monthly: b.monthly,
      spent,
      remaining: b.monthly - spent,
      usedPercent: Math.round((spent / b.monthly) * 100),
      projected,
      status: statusOf(spent, b.monthly, projected, daysPassed),
    })
  }

  return [...rows].sort(
    (a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || b.usedPercent - a.usedPercent,
  )
}
