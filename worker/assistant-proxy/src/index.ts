import { LIMITS, type ChatMessage } from '../../../src/ai/protocol.ts'
import { buildMessages } from '../../../src/ai/prompt.ts'
import { parseAssistantRequest } from '../../../src/ai/validate.ts'

/**
 * Keyless-for-the-browser proxy for the budget assistant. It holds the provider
 * keys (Wrangler secrets), checks the request, and forwards it to the first
 * provider that answers. Request bodies and summaries are never logged.
 */

/** Workers Rate Limiting binding, declared as [[ratelimits]] in wrangler.toml. */
interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>
}

interface Env {
  GEMINI_API_KEY?: string
  GROQ_API_KEY?: string
  OPENROUTER_API_KEY?: string
  /** Comma-separated list of origins allowed to call the proxy. */
  ALLOWED_ORIGINS: string
  /**
   * When set (e.g. "5173"), also allow http origins on a private IPv4 address at exactly this
   * port: the phone loading the Mac's Vite server over the LAN during live iOS testing.
   */
  LAN_DEV_PORT?: string
  RATE_LIMIT_PER_HOUR?: string
  /** Per-IP, per-minute limit shared across isolates in a location. Absent in local tests. */
  LIMITER?: RateLimiter
}

type ProviderName = 'gemini' | 'groq' | 'openrouter'

interface Provider {
  name: ProviderName
  key: (env: Env) => string | undefined
  call: (key: string, system: string, turns: ChatMessage[], timeoutMs: number) => Promise<string>
}

/** One provider may take this long before the next one is tried. The fast models answer in ~1 s. */
const PROVIDER_TIMEOUT_MS = 12_000
/**
 * All providers together must finish within this, so the proxy answers 503 before the app's own
 * 30 s timeout fires and the app can show "unavailable" instead of "timeout".
 */
const TOTAL_BUDGET_MS = 25_000
/** Not worth starting a provider with less time than this left. */
const MIN_PROVIDER_MS = 2_000
const MAX_OUTPUT_TOKENS = 400
const TEMPERATURE = 0.3
const DEFAULT_RATE_LIMIT = 30
const RATE_WINDOW_MS = 60 * 60 * 1000
const RATE_MAP_PRUNE_AT = 5_000

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent'
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const OPENROUTER_MODELS = ['google/gemma-4-31b-it:free', 'nvidia/nemotron-3-super-120b-a12b:free']

const PROVIDERS: readonly Provider[] = [
  {
    name: 'gemini',
    key: (env) => env.GEMINI_API_KEY,
    call: callGemini,
  },
  {
    name: 'groq',
    key: (env) => env.GROQ_API_KEY,
    call: (key, system, turns, timeoutMs) =>
      // gpt-oss reasons before answering; low effort keeps the reasoning inside MAX_OUTPUT_TOKENS.
      callOpenAiStyle(GROQ_URL, key, 'openai/gpt-oss-120b', system, turns, timeoutMs, {}, { reasoning_effort: 'low' }),
  },
  {
    name: 'openrouter',
    key: (env) => env.OPENROUTER_API_KEY,
    // Free models come and go; OpenRouter tries the `models` list in order when one is gone or busy.
    call: (key, system, turns, timeoutMs) =>
      callOpenAiStyle(
        OPENROUTER_URL,
        key,
        OPENROUTER_MODELS[0],
        system,
        turns,
        timeoutMs,
        { 'X-Title': 'Kart Limitlerim' },
        { models: OPENROUTER_MODELS },
      ),
  },
]

/** Best-effort per-IP counter. Each isolate keeps its own map, so the real limit is looser; see README. */
const hits = new Map<string, { count: number; windowStart: number }>()

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin')
    const allowed = origin !== null && isAllowedOrigin(origin, env)
    if (!allowed) return reply(403, { error: 'bad_request' }, null)

    const cors = corsHeaders(origin)

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: { ...cors, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Max-Age': '600' },
      })
    }

    const path = new URL(request.url).pathname
    if (request.method !== 'POST' || (path !== '/' && path !== '/chat')) {
      return reply(405, { error: 'bad_request' }, origin)
    }

    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
    if (isRateLimited(ip, rateLimitOf(env), Date.now())) {
      return reply(429, { error: 'rate_limited' }, origin)
    }
    if (env.LIMITER && !(await withinLimiter(env.LIMITER, ip))) {
      return reply(429, { error: 'rate_limited' }, origin)
    }

    const declared = Number(request.headers.get('content-length'))
    if (Number.isFinite(declared) && declared > LIMITS.maxBodyBytes) {
      return reply(413, { error: 'bad_request' }, origin)
    }

    const text = await request.text()
    if (new TextEncoder().encode(text).byteLength > LIMITS.maxBodyBytes) {
      return reply(413, { error: 'bad_request' }, origin)
    }

    let raw: unknown
    try {
      raw = JSON.parse(text)
    } catch {
      return reply(400, { error: 'bad_request' }, origin)
    }

    const req = parseAssistantRequest(raw)
    if (!req) return reply(400, { error: 'bad_request' }, origin)

    const configured = PROVIDERS.flatMap((p) => {
      const key = p.key(env)?.trim()
      return key ? [{ provider: p, key }] : []
    })
    if (configured.length === 0) return reply(503, { error: 'not_configured' }, origin)

    const { system, turns } = buildMessages(req)
    const deadline = Date.now() + TOTAL_BUDGET_MS
    for (const { provider, key } of configured) {
      const left = deadline - Date.now()
      if (left < MIN_PROVIDER_MS) {
        console.warn(`assistant: out of time before ${provider.name}`)
        break
      }
      try {
        const answer = (await provider.call(key, system, turns, Math.min(PROVIDER_TIMEOUT_MS, left))).trim()
        if (answer) return reply(200, { text: answer, provider: provider.name }, origin)
        console.warn(`assistant: ${provider.name} returned no text`)
      } catch (err) {
        // Log the provider name and error kind only, never request content.
        console.warn(`assistant: ${provider.name} failed (${errorKind(err)})`)
      }
    }

    return reply(503, { error: 'unavailable' }, origin)
  },
}

async function callGemini(key: string, system: string, turns: ChatMessage[], timeoutMs: number): Promise<string> {
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: turns.map((t) => ({
      role: t.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: t.text }],
    })),
    generationConfig: {
      temperature: TEMPERATURE,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      // Gemini 3 models think by default and the thinking tokens count against maxOutputTokens;
      // thinkingBudget is ignored there, so ask for the lowest thinking level instead.
      thinkingConfig: { thinkingLevel: 'low' },
    },
  }
  const data = await postJson(GEMINI_URL, { 'x-goog-api-key': key }, body, timeoutMs)
  return geminiText(data)
}

async function callOpenAiStyle(
  url: string,
  key: string,
  model: string,
  system: string,
  turns: ChatMessage[],
  timeoutMs: number,
  extraHeaders: Record<string, string>,
  extraBody: Record<string, unknown> = {},
): Promise<string> {
  const body = {
    ...extraBody,
    model,
    temperature: TEMPERATURE,
    max_tokens: MAX_OUTPUT_TOKENS,
    messages: [
      { role: 'system', content: system },
      ...turns.map((t) => ({ role: t.role, content: t.text })),
    ],
  }
  const data = await postJson(url, { Authorization: `Bearer ${key}`, ...extraHeaders }, body, timeoutMs)
  return openAiText(data)
}

/** POSTs JSON with a timeout. Throws on a non-OK status or an unreadable body. */
async function postJson(url: string, headers: Record<string, string>, body: unknown, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!res.ok) throw new ProviderError(res.status)
    const data: unknown = await res.json()
    return data
  } finally {
    clearTimeout(timer)
  }
}

function geminiText(data: unknown): string {
  const first = itemsOf(fieldOf(data, 'candidates'))[0]
  const parts = itemsOf(fieldOf(fieldOf(first, 'content'), 'parts'))
  return parts
    .map((part) => {
      const text = fieldOf(part, 'text')
      return typeof text === 'string' ? text : ''
    })
    .join('')
}

function openAiText(data: unknown): string {
  const first = itemsOf(fieldOf(data, 'choices'))[0]
  const content = fieldOf(fieldOf(first, 'message'), 'content')
  return typeof content === 'string' ? content : ''
}

function fieldOf(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined
}

function itemsOf(value: unknown): unknown[] {
  const list: unknown[] = Array.isArray(value) ? value : []
  return list
}

class ProviderError extends Error {
  status: number

  constructor(status: number) {
    super(`HTTP ${status}`)
    this.name = 'ProviderError'
    this.status = status
  }
}

function errorKind(err: unknown): string {
  if (err instanceof ProviderError) return `HTTP ${err.status}`
  if (err instanceof DOMException && err.name === 'AbortError') return 'timeout'
  if (err instanceof SyntaxError) return 'invalid JSON'
  return 'network'
}

function parseOrigins(list: string): string[] {
  return list
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0)
}

function isAllowedOrigin(origin: string, env: Env): boolean {
  if (parseOrigins(env.ALLOWED_ORIGINS).includes(origin)) return true
  const port = env.LAN_DEV_PORT?.trim()
  return port ? isPrivateLanOrigin(origin, port) : false
}

/** `http://<10/8 | 172.16/12 | 192.168/16 address>:<port>` and nothing else. */
function isPrivateLanOrigin(origin: string, port: string): boolean {
  const m = /^http:\/\/(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3}):(\d{1,5})$/.exec(origin)
  if (!m || m[5] !== port) return false
  const [a, b, c, d] = m.slice(1, 5).map(Number)
  if ([a, b, c, d].some((n) => n > 255)) return false
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
}

function corsHeaders(origin: string | null): Record<string, string> {
  if (origin === null) return {}
  return { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
}

function reply(status: number, body: unknown, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      ...corsHeaders(origin),
    },
  })
}

function rateLimitOf(env: Env): number {
  const parsed = Number.parseInt(env.RATE_LIMIT_PER_HOUR ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_RATE_LIMIT
}

/**
 * Per-IP check against the Workers Rate Limiting binding. Fails open: if the
 * binding throws, the request goes through and only the failure is logged.
 */
async function withinLimiter(limiter: RateLimiter, ip: string): Promise<boolean> {
  try {
    const { success } = await limiter.limit({ key: ip })
    return success
  } catch {
    console.warn('assistant: limiter failed')
    return true
  }
}

/**
 * Fixed hourly window per IP, kept in memory. Each isolate has its own map, so
 * this is only a brake on bursts. The LIMITER binding is the real per-minute limit.
 */
function isRateLimited(ip: string, limit: number, now: number): boolean {
  if (hits.size > RATE_MAP_PRUNE_AT) {
    for (const [key, entry] of hits) {
      if (now - entry.windowStart >= RATE_WINDOW_MS) hits.delete(key)
    }
  }

  const entry = hits.get(ip)
  if (!entry || now - entry.windowStart >= RATE_WINDOW_MS) {
    hits.set(ip, { count: 1, windowStart: now })
    return false
  }
  if (entry.count >= limit) return true
  entry.count += 1
  return false
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
