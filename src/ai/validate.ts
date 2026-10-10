import type { BudgetSummary, SummaryAccount } from '../domain/insightsTypes'
import { LIMITS } from './protocol'
import type { AssistantRequest, ChatMessage, ChatRole } from './protocol'

/**
 * Shape check for a request body received by the proxy. It rejects anything
 * outside the wire contract. The summary is rebuilt field by field (parseSummary).
 * Returns a fresh object holding only known keys.
 */
export function parseAssistantRequest(raw: unknown): AssistantRequest | null {
  if (!isRecord(raw) || raw.v !== 1) return null

  const messages = parseMessages(raw.messages)
  if (!messages) return null

  const summary = parseSummary(raw.summary)
  if (!summary) return null

  return { v: 1, summary, messages }
}

function parseMessages(raw: unknown): ChatMessage[] | null {
  if (!Array.isArray(raw)) return null
  if (raw.length < 1 || raw.length > LIMITS.maxMessages) return null

  const messages: ChatMessage[] = []
  for (const item of raw) {
    const message = parseMessage(item)
    if (!message) return null
    messages.push(message)
  }

  if (messages[messages.length - 1].role !== 'user') return null
  return messages
}

function parseMessage(raw: unknown): ChatMessage | null {
  if (!isRecord(raw)) return null

  const role = toRole(raw.role)
  if (!role) return null

  const text = raw.text
  if (typeof text !== 'string' || text.trim().length === 0) return null
  if (text.length > LIMITS.maxMessageChars) return null

  return { role, text }
}

function toRole(value: unknown): ChatRole | null {
  if (value === 'user') return 'user'
  if (value === 'assistant') return 'assistant'
  return null
}

const ACCOUNT_KINDS = ['kart', 'KMH', 'banka', 'nakit'] as const
const SEVERITIES = ['crit', 'warn', 'info'] as const
const BUDGET_STATUSES = ['ok', 'near', 'pace', 'over'] as const
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Thrown inside parseSummary on the first field that breaks the contract. */
class Invalid extends Error {}

/**
 * Rebuilds the summary field by field. Only known keys are copied; free text is cut to its limit
 * and lists to their size, so the proxy cannot be used to send arbitrary text to a model.
 */
export function parseSummary(value: unknown): BudgetSummary | null {
  try {
    const s = record(value)
    const power = record(s.power)
    const outlook = record(s.outlook)
    const month = record(s.month)
    return {
      date: isoDate(s.date),
      power: { total: figure(power.total), cards: figure(power.cards), kmh: figure(power.kmh), cash: figure(power.cash) },
      outlook: {
        until: isoDate(outlook.until),
        days: count(outlook.days),
        minimums: figure(outlook.minimums),
        unknownMinimums: count(outlook.unknownMinimums),
        recurring: figure(outlook.recurring),
        powerAfter: figure(outlook.powerAfter),
        cashAfter: figure(outlook.cashAfter),
        shortfall: bool(outlook.shortfall),
      },
      accounts: list(s.accounts, LIMITS.maxAccounts, parseAccount),
      categories: list(s.categories, LIMITS.maxCategories, (c) => {
        const r = record(c)
        return {
          name: text(r.name, LIMITS.maxNameChars),
          thisMonth: figure(r.thisMonth),
          lastMonthSamePeriod: figure(r.lastMonthSamePeriod),
          changePercent: r.changePercent === null ? null : int(r.changePercent),
        }
      }),
      month: {
        spent: figure(month.spent),
        lastMonthSamePeriod: figure(month.lastMonthSamePeriod),
        lastMonthTotal: figure(month.lastMonthTotal),
        projected: figure(month.projected),
        daysPassed: count(month.daysPassed),
        daysInMonth: count(month.daysInMonth),
      },
      budgets: list(s.budgets, LIMITS.maxBudgets, (b) => {
        const r = record(b)
        return {
          category: text(r.category, LIMITS.maxNameChars),
          monthly: figure(r.monthly),
          spent: figure(r.spent),
          remaining: figure(r.remaining),
          usedPercent: int(r.usedPercent),
          projected: figure(r.projected),
          status: oneOf(r.status, BUDGET_STATUSES),
        }
      }),
      insights: list(s.insights, LIMITS.maxInsights, (i) => {
        const r = record(i)
        return {
          severity: oneOf(r.severity, SEVERITIES),
          title: text(r.title, LIMITS.maxTitleChars),
          body: text(r.body, LIMITS.maxBodyChars),
        }
      }),
    }
  } catch (err) {
    if (err instanceof Invalid) return null
    throw err
  }
}

function parseAccount(value: unknown): SummaryAccount {
  const r = record(value)
  const account: SummaryAccount = {
    name: text(r.name, LIMITS.maxNameChars),
    kind: oneOf(r.kind, ACCOUNT_KINDS),
    available: figure(r.available),
  }
  if (r.limit !== undefined) account.limit = figure(r.limit)
  if (r.nextCut !== undefined) account.nextCut = isoDate(r.nextCut)
  if (r.due !== undefined) account.due = isoDate(r.due)
  if (r.statementDebt !== undefined) account.statementDebt = figure(r.statementDebt)
  if (r.minimumOutstanding !== undefined) account.minimumOutstanding = figure(r.minimumOutstanding)
  if (r.paid !== undefined) account.paid = bool(r.paid)
  return account
}

function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Invalid()
  return value
}

function list<T>(value: unknown, max: number, item: (v: unknown) => T): T[] {
  if (!Array.isArray(value)) throw new Invalid()
  return value.slice(0, max).map(item)
}

function text(value: unknown, max: number): string {
  if (typeof value !== 'string') throw new Invalid()
  return value.slice(0, max)
}

/** A formatted amount: digits, separators, sign and the lira sign only. */
function figure(value: unknown): string {
  if (typeof value !== 'string' || value.length > LIMITS.maxFigureChars || !/^[-−+]?[\d.,\s]*\d[\d.,\s]*\s?₺?$/u.test(value)) {
    throw new Invalid()
  }
  return value
}

function isoDate(value: unknown): string {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) throw new Invalid()
  return value
}

function int(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) throw new Invalid()
  return value
}

function count(value: unknown): number {
  const n = int(value)
  if (n < 0 || n > 10_000) throw new Invalid()
  return n
}

function bool(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new Invalid()
  return value
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T {
  if (!allowed.includes(value as T)) throw new Invalid()
  return value as T
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
