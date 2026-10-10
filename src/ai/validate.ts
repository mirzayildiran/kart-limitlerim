import type { BudgetSummary } from '../domain/insightsTypes'
import { LIMITS } from './protocol'
import type { AssistantRequest, ChatMessage, ChatRole } from './protocol'

/**
 * Shape check for a request body received by the proxy. It rejects anything
 * outside the wire contract. The summary is only shape-checked, not deep-validated.
 * Returns a fresh object holding only the known top-level keys.
 */
export function parseAssistantRequest(raw: unknown): AssistantRequest | null {
  if (!isRecord(raw) || raw.v !== 1) return null

  const messages = parseMessages(raw.messages)
  if (!messages) return null

  if (!isSummaryShape(raw.summary)) return null

  return { v: 1, summary: raw.summary, messages }
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

function isSummaryShape(value: unknown): value is BudgetSummary {
  if (!isRecord(value)) return false
  return (
    typeof value.date === 'string' &&
    isRecord(value.power) &&
    isRecord(value.outlook) &&
    Array.isArray(value.accounts) &&
    Array.isArray(value.categories) &&
    Array.isArray(value.insights)
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
