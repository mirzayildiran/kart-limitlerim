import type { BudgetSummary } from '../domain/insightsTypes'
import { LIMITS } from './protocol'
import type { AssistantErrorCode, AssistantReply, AssistantRequest, ChatMessage } from './protocol'

/** Base URL of the assistant proxy, or null when this build has no assistant. */
export const PROXY_URL: string | null = toUrlOrNull(
  import.meta.env.VITE_ASSISTANT_PROXY_URL as string | undefined,
)

const DEFAULT_TIMEOUT_MS = 30_000

const ERROR_CODES: readonly AssistantErrorCode[] = [
  'not_configured',
  'offline',
  'timeout',
  'rate_limited',
  'bad_request',
  'unavailable',
  'no_consent',
]

const MESSAGES: Record<AssistantErrorCode, string> = {
  not_configured: 'Asistan bu sürümde kurulu değil. Öneriler yine de çalışır.',
  offline: 'İnternet bağlantısı yok. Bağlanınca yeniden dene.',
  timeout: 'Asistan çok geç yanıt verdi. Birazdan yeniden dene.',
  rate_limited: 'Asistan şu an çok yoğun. Birkaç dakika sonra yeniden dene.',
  bad_request: 'Mesaj asistana iletilemedi. Mesajı kısaltıp yeniden dene.',
  unavailable: 'Asistan şu an yanıt veremiyor. Daha sonra yeniden dene.',
  no_consent: 'Sohbet kapalı. Açmak için önce onay ekranını onayla.',
}

/** A failed assistant call, carrying the code the UI maps to a message. */
export class AssistantError extends Error {
  code: AssistantErrorCode

  constructor(code: AssistantErrorCode) {
    super(code)
    this.name = 'AssistantError'
    this.code = code
  }
}

/**
 * Keeps the request within the proxy limits: the last maxMessages messages,
 * starting with a user turn, each text cut to maxMessageChars.
 */
export function trimHistory(messages: ChatMessage[]): ChatMessage[] {
  const recent = messages.slice(-LIMITS.maxMessages)
  const firstUser = recent.findIndex((m) => m.role === 'user')
  const kept = firstUser < 0 ? [] : recent.slice(firstUser)
  return kept.map((m) => ({ role: m.role, text: clip(m.text) }))
}

/**
 * Sends the budget summary and the chat to the proxy and returns its reply.
 * Throws AssistantError for every expected failure. A caller's own abort is
 * rethrown unchanged.
 */
export async function askAssistant(
  summary: BudgetSummary,
  messages: ChatMessage[],
  opts: {
    /** Required, so no caller can send without the user's consent (App Store 5.1.2, KVKK). */
    consented: boolean
    url?: string | null
    fetchImpl?: typeof fetch
    timeoutMs?: number
    signal?: AbortSignal
  },
): Promise<AssistantReply> {
  if (opts.consented !== true) throw new AssistantError('no_consent')
  const url = opts.url === undefined ? PROXY_URL : opts.url
  if (!url) throw new AssistantError('not_configured')
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new AssistantError('offline')

  const doFetch = opts.fetchImpl ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init))
  const body: AssistantRequest = { v: 1, summary, messages: trimHistory(messages) }

  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  const onUserAbort = () => controller.abort()
  if (opts.signal?.aborted) controller.abort()
  opts.signal?.addEventListener('abort', onUserAbort)

  try {
    const res = await doFetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!res.ok) throw new AssistantError(await errorCodeOf(res))

    const data: unknown = await res.json()
    if (!isRecord(data) || typeof data.text !== 'string' || data.text.trim() === '' || typeof data.provider !== 'string') {
      throw new AssistantError('unavailable')
    }
    return { text: data.text, provider: data.provider }
  } catch (err) {
    if (err instanceof AssistantError) throw err
    if (timedOut) throw new AssistantError('timeout')
    if (opts.signal?.aborted) throw err
    throw new AssistantError(err instanceof TypeError ? 'offline' : 'unavailable')
  } finally {
    clearTimeout(timer)
    opts.signal?.removeEventListener('abort', onUserAbort)
  }
}

/** Turkish message for the user. Says what happened and what to do next. */
export function errorMessage(code: AssistantErrorCode): string {
  return MESSAGES[code]
}

async function errorCodeOf(res: Response): Promise<AssistantErrorCode> {
  if (res.status === 429) return 'rate_limited'
  if (res.status === 400) return 'bad_request'
  // The proxy does not accept this app's origin: a setup problem, not something the user can fix.
  if (res.status === 403) return 'not_configured'
  const body: unknown = await res.json()
  const code = isRecord(body) ? body.error : undefined
  return isErrorCode(code) ? code : 'unavailable'
}

function clip(text: string): string {
  const max = LIMITS.maxMessageChars
  if (text.length <= max) return text
  let cut = text.slice(0, max)
  // Do not leave a lone high surrogate at the end.
  const last = cut.charCodeAt(cut.length - 1)
  if (last >= 0xd800 && last <= 0xdbff) cut = cut.slice(0, -1)
  return cut
}

function toUrlOrNull(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function isErrorCode(value: unknown): value is AssistantErrorCode {
  return typeof value === 'string' && (ERROR_CODES as readonly string[]).includes(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
