import type { BudgetSummary } from '../domain/insightsTypes'

/**
 * Wire contract between the app and the assistant proxy (worker/assistant-proxy).
 * The proxy holds the provider API keys; the app never sees them. This file is
 * imported by both sides, so it must stay free of browser and Worker APIs.
 */

export type ChatRole = 'user' | 'assistant'

export interface ChatMessage {
  role: ChatRole
  text: string
}

export interface AssistantRequest {
  /** Protocol version; the proxy rejects others. */
  v: 1
  summary: BudgetSummary
  /** Conversation so far, oldest first, ending with the user's new message. */
  messages: ChatMessage[]
}

export interface AssistantReply {
  text: string
  /** Provider that answered, e.g. "gemini"; shown in small print. */
  provider: string
}

export type AssistantErrorCode =
  | 'not_configured'
  | 'offline'
  | 'timeout'
  | 'rate_limited'
  | 'bad_request'
  | 'unavailable'
  /** Client only: the user has not consented, so nothing was sent. The proxy never returns it. */
  | 'no_consent'

export interface AssistantErrorBody {
  error: AssistantErrorCode
}

export const LIMITS = {
  /** Most messages sent per request (older ones are dropped by the client). */
  maxMessages: 12,
  /** Longest single message, in characters. */
  maxMessageChars: 1000,
  /** Largest JSON body the proxy accepts, in bytes. */
  maxBodyBytes: 16_000,
} as const
