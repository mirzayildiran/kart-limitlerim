/**
 * Domain model. All money values are integer kuruş (1 ₺ = 100 kuruş) to avoid
 * floating-point drift; convert only at the UI edge (see money.ts).
 * Dates are local calendar dates as ISO strings (YYYY-MM-DD).
 */

export type Kurus = number
export type IsoDate = string
/** Statement cycle key: the year-month of the statement cut date, e.g. "2026-09". */
export type CycleKey = string

export type AccountKind = 'card' | 'kmh' | 'bank' | 'cash'

interface AccountBase {
  id: string
  kind: AccountKind
  /** Bank or app name as the user knows it, e.g. "Akbank", "Nakit". */
  name: string
  note?: string
  /** Epoch ms of the last time the user confirmed this account's figures. */
  updatedAt: number
  createdAt: number
}

/** How much of a statement was paid by its due date. */
export type PaymentState = 'unpaid' | 'partial' | 'minimum' | 'full'

/**
 * One physical/virtual card under a card account. Several cards can share one
 * customer limit (e.g. a main card and a digital card) but each has its own
 * statement cycle.
 */
export interface CardLine {
  id: string
  label: string
  /** Day of month the statement is cut (1–31, clamped to month length). */
  cutDay: number
  /** Days from cut to due date when the user hasn't entered the exact date. */
  dueOffsetDays: number
  /** Optional per-card spending cap inside the shared limit. */
  subLimit?: Kurus | null
  /** The statement the fields below describe; stale when ≠ current cycle. */
  cycle: CycleKey | null
  statementDebt?: Kurus | null
  minimumDue?: Kurus | null
  /** Exact due date from the statement, if the user entered it. */
  dueDate?: IsoDate | null
  payment: PaymentState
  paidAmount?: Kurus | null
  /** Interest actually printed on the current statement, if the user entered it. */
  interestCharged?: Kurus | null
  /** Interest per past cycle, appended when a cycle closes. Newest last. */
  interestHistory?: InterestRecord[]
}

export interface InterestRecord {
  cycle: CycleKey
  amount: Kurus
  source: 'estimate' | 'statement'
}

export interface RateOverride {
  /** Monthly contractual rate in percent, e.g. 3.25. */
  contractual: number
  /** Monthly late-payment rate in percent. */
  late: number
}

export interface CardAccount extends AccountBase {
  kind: 'card'
  limit: Kurus
  available: Kurus
  lines: CardLine[]
  rateOverride?: RateOverride | null
}

export interface KmhAccount extends AccountBase {
  kind: 'kmh'
  limit: Kurus
  available: Kurus
  rateOverride?: RateOverride | null
}

export interface BalanceAccount extends AccountBase {
  kind: 'bank' | 'cash'
  balance: Kurus
}

export type Account = CardAccount | KmhAccount | BalanceAccount

export interface Category {
  id: string
  name: string
  /** Hue 0–359; the UI derives theme-aware colors from it. */
  hue: number
  builtin: boolean
  order: number
  archived?: boolean
}

export interface Expense {
  id: string
  amount: Kurus
  categoryId: string
  accountId: string
  date: IsoDate
  note: string
  /** Whether saving this expense reduced the account's available limit/balance. */
  affectsAccount: boolean
  /** Total installment count for card purchases (1 = single payment). */
  installments: number
  /** Where the record came from. */
  source: 'manual' | 'screenshot' | 'recurring'
  /** Recurring payment that generated it, if any. */
  recurringId?: string | null
  createdAt: number
}

export type RecurrenceEnd =
  | { type: 'never' }
  | { type: 'until'; date: IsoDate }
  | { type: 'count'; count: number }

export interface RecurringPayment {
  id: string
  name: string
  amount: Kurus
  categoryId: string
  accountId: string
  /** Day of month it is charged (1–31, clamped to month length). */
  dayOfMonth: number
  startDate: IsoDate
  end: RecurrenceEnd
  active: boolean
  /** Occurrences on or before this date were already added or skipped by the user. */
  handledThrough?: IsoDate | null
  createdAt: number
}

/** Merchant text → category, learned from the user's corrections. */
export interface MerchantRule {
  id: string
  pattern: string
  categoryId: string
  hits: number
}

/** Monthly spending target for one category (the user's budget plan). */
export interface CategoryBudget {
  categoryId: string
  /** Target for one calendar month, kuruş, > 0. */
  monthly: Kurus
}
