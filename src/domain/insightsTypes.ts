import type { Account, Category, CategoryBudget, Expense, Kurus, RecurringPayment } from './types'

/**
 * Shared contracts for the budget assistant. Every figure the assistant shows
 * or sends is computed here in the domain layer; the language model only reads
 * and explains the result.
 */

export interface InsightInput {
  accounts: Account[]
  expenses: Expense[]
  categories: Category[]
  recurring: RecurringPayment[]
  /** The user's monthly category targets; empty or missing when there is no plan. */
  budgets?: CategoryBudget[]
  /** Local start of today. */
  today: Date
}

export type InsightSeverity = 'crit' | 'warn' | 'info'

export type InsightKind =
  | 'cashShortfall'
  | 'statementDue'
  | 'cardNearLimit'
  | 'kmhInterest'
  | 'minimumInterest'
  | 'categoryIncrease'
  | 'bestCard'
  | 'budgetOver'
  | 'budgetPace'
  | 'monthPace'

/** One rule-based suggestion. Texts are Turkish, addressed with "sen". */
export interface Insight {
  /** Stable for the same situation, e.g. "statementDue:acc1:0". */
  id: string
  kind: InsightKind
  severity: InsightSeverity
  /** Short headline, e.g. "Asgari ödeme 3 gün sonra". */
  title: string
  /** One or two plain sentences with the figures already formatted. */
  body: string
  /** Main figure behind the insight, in kuruş, when there is one. */
  amount?: Kurus
  /** The account (card, KMH) the insight concerns; absent for budget-wide notes. */
  accountId?: string
}

/**
 * Compact, JSON-serialisable picture of the user's budget. This is the only
 * user data that leaves the device (and only after consent). No single expense,
 * note or date of birth-like detail goes in; amounts are pre-formatted strings
 * so the model never has to calculate.
 */
export interface BudgetSummary {
  /** ISO date the summary was made for. */
  date: string
  power: {
    /** "Şu an harcayabileceğin" total, formatted, e.g. "24.500 ₺". */
    total: string
    cards: string
    kmh: string
    cash: string
  }
  outlook: {
    /** Next statement cut the outlook runs to, ISO date. */
    until: string
    days: number
    minimums: string
    unknownMinimums: number
    recurring: string
    powerAfter: string
    cashAfter: string
    /** True when cashAfter is negative. */
    shortfall: boolean
  }
  accounts: SummaryAccount[]
  /** Spending per category, month to date vs. the same days last month. */
  categories: SummaryCategory[]
  /** Whole-month spending pace; figures are estimates. */
  month: SummaryMonth
  /** The user's budget plan with progress; empty when there is no plan. */
  budgets: SummaryBudget[]
  /** Rule-based insights, already worded. */
  insights: { severity: InsightSeverity; title: string; body: string }[]
  /** Card installment plans still being billed; absent when there are none. */
  installments?: SummaryInstallments
}

export interface SummaryInstallments {
  plans: number
  /** This month's installments, all plans together. */
  monthly: string
  /** Everything still to be billed, this month included. */
  remaining: string
}

export interface SummaryAccount {
  /** Name exactly as the user entered it (shown on the consent screen). */
  name: string
  kind: 'kart' | 'KMH' | 'banka' | 'nakit'
  /** Free limit (card/KMH) or balance (bank/cash). */
  available: string
  /** Total limit, card/KMH only. */
  limit?: string
  /** Card only: nearest statement line. */
  nextCut?: string
  due?: string
  statementDebt?: string
  minimumOutstanding?: string
  paid?: boolean
}

export interface SummaryCategory {
  name: string
  thisMonth: string
  lastMonthSamePeriod: string
  /** Whole-percent change, null when last month was zero. */
  changePercent: number | null
}

export interface SummaryMonth {
  /** Spent this month up to today. */
  spent: string
  /** Same days of last month. */
  lastMonthSamePeriod: string
  /** Whole of last month. */
  lastMonthTotal: string
  /** Estimated month-end total if the daily pace holds (tahmini). */
  projected: string
  daysPassed: number
  daysInMonth: number
}

export interface SummaryBudget {
  category: string
  monthly: string
  spent: string
  /** Negative when over the target. */
  remaining: string
  /** Whole percent of the target used so far. */
  usedPercent: number
  /** Estimated month-end spend at the current pace (tahmini). */
  projected: string
  status: BudgetStatus
}

/** ok: on track; near: ≥ 80% used; pace: projected to exceed; over: already exceeded. */
export type BudgetStatus = 'ok' | 'near' | 'pace' | 'over'
