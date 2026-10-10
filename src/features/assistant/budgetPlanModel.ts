import { PACE_MIN_DAYS, type BudgetRow, type MonthPace } from '../../domain/budget'
import type { BudgetStatus } from '../../domain/insightsTypes'
import type { Category, CategoryBudget, Kurus } from '../../domain/types'

/** Pure helpers for the budget plan section of the assistant screen. */

/** Days into the month before the month-end estimate is shown. */
export const FORECAST_MIN_DAYS = PACE_MIN_DAYS

export function statusLabel(s: BudgetStatus): string {
  if (s === 'ok') return 'Yolunda'
  if (s === 'near') return 'Hedefe yakın'
  if (s === 'pace') return 'Bu hızla aşılır'
  return 'Aşıldı'
}

export function statusTone(s: BudgetStatus): 'ok' | 'warn' | 'crit' {
  if (s === 'ok') return 'ok'
  if (s === 'over') return 'crit'
  return 'warn'
}

/** Share of the target already spent, 0 to 1, for the progress fill. */
export function barRatio(row: Pick<BudgetRow, 'spent' | 'monthly'>): number {
  if (row.monthly <= 0) return 0
  return Math.min(1, row.spent / row.monthly)
}

/** Active categories that have no target yet, in the order given. */
export function unplannedCategories(categories: Category[], budgets: CategoryBudget[]): Category[] {
  const planned = new Set(budgets.map((b) => b.categoryId))
  return categories.filter((c) => !c.archived && !planned.has(c.id))
}

/** Whether the month-end estimate is meaningful yet. */
export function hasForecast(pace: Pick<MonthPace, 'daysPassed'>): boolean {
  return pace.daysPassed >= FORECAST_MIN_DAYS
}

/**
 * Remaining amount as shown next to "spent / monthly". Both of those are shown
 * rounded to whole lira, so the difference is taken from the rounded values;
 * otherwise "1.592 ₺ / 4.000 ₺ · Kalan 2.409 ₺" would not add up.
 */
export function shownRemaining(row: Pick<BudgetRow, 'spent' | 'monthly'>): Kurus {
  const lira = (k: Kurus) => Math.round(k / 100) * 100
  return lira(row.monthly) - lira(row.spent)
}
