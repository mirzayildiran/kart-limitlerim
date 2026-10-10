import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import worker from './index.ts'
import { LIMITS } from '../../../src/ai/protocol.ts'

type Env = Parameters<typeof worker.fetch>[1]

const ORIGIN = 'https://mirzayildiran.github.io'
const ALLOWED = `${ORIGIN},http://localhost:5173`
// Fake keys. They only need to be present; the stubbed fetch never sends them anywhere.
const KEYS = {
  GEMINI_API_KEY: 'fake-gemini-key',
  GROQ_API_KEY: 'fake-groq-key',
  OPENROUTER_API_KEY: 'fake-openrouter-key',
}

const SUMMARY = {
  date: '2026-10-10',
  power: { total: '24.500 ₺', cards: '20.000 ₺', kmh: '4.500 ₺', cash: '0 ₺' },
  outlook: {
    until: '2026-11-05',
    days: 26,
    minimums: '0 ₺',
    unknownMinimums: 0,
    recurring: '0 ₺',
    powerAfter: '24.500 ₺',
    cashAfter: '0 ₺',
    shortfall: false,
  },
  accounts: [],
  categories: [],
  month: { spent: '0 ₺', lastMonthSamePeriod: '0 ₺', lastMonthTotal: '0 ₺', projected: '0 ₺', daysPassed: 10, daysInMonth: 31 },
  budgets: [],
  insights: [],
}

// Each test gets its own IP because the in-memory hourly map persists across tests.
let ipCounter = 0
function nextIp(): string {
  ipCounter += 1
  return `203.0.113.${ipCounter}`
}

function env(extra: Partial<Env> = {}): Env {
  return { ALLOWED_ORIGINS: ALLOWED, ...KEYS, ...extra }
}

function validBody(text = 'Bu ay ne kadar harcayabilirim?'): unknown {
  return { v: 1, summary: SUMMARY, messages: [{ role: 'user', text }] }
}

function post(ip: string, body: unknown, origin: string | null = ORIGIN): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json', 'CF-Connecting-IP': ip }
  if (origin !== null) headers.Origin = origin
  return new Request('https://worker.example/chat', {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function geminiReply(text: string): Response {
  return json({ candidates: [{ content: { parts: [{ text }] } }] })
}

function groqReply(text: string): Response {
  return json({ choices: [{ message: { content: text } }] })
}

const isGemini = (url: string): boolean => url.includes('generativelanguage.googleapis.com')

function stubFetch(handler: (url: string, init: RequestInit | undefined) => Response | Promise<Response>) {
  const mock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => handler(String(input), init))
  vi.stubGlobal('fetch', mock)
  return mock
}

beforeEach(() => {
  // The worker logs provider failures on purpose; keep test output quiet and inspect the calls where needed.
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('origin and CORS', () => {
  it('rejects an origin that is not in ALLOWED_ORIGINS with 403', async () => {
    const fetchMock = stubFetch(() => geminiReply('unused'))
    const res = await worker.fetch(post(nextIp(), validBody(), 'https://evil.example'), env())
    expect(res.status).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects a request without an Origin header with 403', async () => {
    const res = await worker.fetch(post(nextIp(), validBody(), null), env())
    expect(res.status).toBe(403)
  })

  it('answers a preflight from an allowed origin with 204 and CORS headers', async () => {
    const req = new Request('https://worker.example/chat', { method: 'OPTIONS', headers: { Origin: ORIGIN } })
    const res = await worker.fetch(req, env())
    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN)
    expect(res.headers.get('Access-Control-Allow-Methods')).toBe('POST, OPTIONS')
  })
})

describe('request validation', () => {
  it('rejects GET with 405', async () => {
    const req = new Request('https://worker.example/chat', {
      method: 'GET',
      headers: { Origin: ORIGIN, 'CF-Connecting-IP': nextIp() },
    })
    const res = await worker.fetch(req, env())
    expect(res.status).toBe(405)
  })

  it('rejects invalid JSON with 400', async () => {
    const res = await worker.fetch(post(nextIp(), '{not json'), env())
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'bad_request' })
  })

  it('rejects a body with the wrong shape with 400', async () => {
    // Last message must be the user's; here it is the assistant's.
    const body = { v: 1, summary: SUMMARY, messages: [{ role: 'assistant', text: 'Merhaba' }] }
    const res = await worker.fetch(post(nextIp(), body), env())
    expect(res.status).toBe(400)
  })

  it('rejects a body larger than LIMITS.maxBodyBytes with 413', async () => {
    const body = validBody('a'.repeat(LIMITS.maxBodyBytes))
    const res = await worker.fetch(post(nextIp(), body), env())
    expect(res.status).toBe(413)
    expect(await res.json()).toEqual({ error: 'bad_request' })
  })
})

describe('providers', () => {
  it('returns 503 not_configured when no provider key is set', async () => {
    const fetchMock = stubFetch(() => geminiReply('unused'))
    const res = await worker.fetch(post(nextIp(), validBody()), { ALLOWED_ORIGINS: ALLOWED })
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'not_configured' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns Gemini text and sends the expected URL, key header and thinking level', async () => {
    const fetchMock = stubFetch(() => geminiReply('Merhaba'))
    const res = await worker.fetch(post(nextIp(), validBody()), env())

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ text: 'Merhaba', provider: 'gemini' })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('gemini-flash-lite-latest')
    expect(init?.headers).toMatchObject({ 'x-goog-api-key': KEYS.GEMINI_API_KEY })
    const sent: unknown = JSON.parse(String(init?.body))
    expect(sent).toMatchObject({ generationConfig: { thinkingConfig: { thinkingLevel: 'low' } } })
  })

  it('fails over to Groq when Gemini returns HTTP 500', async () => {
    const fetchMock = stubFetch((url) => (isGemini(url) ? new Response('boom', { status: 500 }) : groqReply('Selam')))
    const res = await worker.fetch(post(nextIp(), validBody()), env())

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ text: 'Selam', provider: 'groq' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const sent: unknown = JSON.parse(String(fetchMock.mock.calls[1][1]?.body))
    expect(sent).toMatchObject({ model: 'openai/gpt-oss-120b', reasoning_effort: 'low' })
  })

  it('returns 503 unavailable without provider error text when every provider fails', async () => {
    const fetchMock = stubFetch(() => new Response('PROVIDER-DETAIL-SECRET', { status: 500 }))
    const res = await worker.fetch(post(nextIp(), validBody()), env())

    expect(res.status).toBe(503)
    const text = await res.text()
    expect(JSON.parse(text)).toEqual({ error: 'unavailable' })
    expect(text).not.toContain('PROVIDER-DETAIL-SECRET')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('never includes the summary or the message text in error responses or logs', async () => {
    const messageText = 'MESAJ-GIZLI-4417'
    const summary = {
      ...SUMMARY,
      insights: [{ severity: 'warning', title: 'OZET-GIZLI-9921', body: 'ozet metni' }],
    }
    stubFetch(() => new Response('x', { status: 500 }))
    const body = { v: 1, summary, messages: [{ role: 'user', text: messageText }] }

    const res = await worker.fetch(post(nextIp(), body), env())
    expect(res.status).toBe(503)

    const text = await res.text()
    expect(text).not.toContain(messageText)
    expect(text).not.toContain('OZET-GIZLI-9921')

    const logged = vi
      .mocked(console.warn)
      .mock.calls.map((args) => args.join(' '))
      .join('\n')
    expect(logged).not.toContain(messageText)
    expect(logged).not.toContain('OZET-GIZLI-9921')
  })
})

describe('rate limiting', () => {
  it('returns 429 when the LIMITER binding reports the limit is exceeded', async () => {
    const fetchMock = stubFetch(() => geminiReply('unused'))
    const limiter = { limit: vi.fn(async (_options: { key: string }) => ({ success: false })) }
    const ip = nextIp()

    const res = await worker.fetch(post(ip, validBody()), env({ LIMITER: limiter }))

    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ error: 'rate_limited' })
    expect(limiter.limit).toHaveBeenCalledWith({ key: ip })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('lets the request through when the LIMITER binding throws, and logs only the failure', async () => {
    stubFetch(() => geminiReply('Merhaba'))
    const limiter = {
      limit: vi.fn(async (_options: { key: string }): Promise<{ success: boolean }> => {
        throw new Error('binding unavailable')
      }),
    }

    const res = await worker.fetch(post(nextIp(), validBody()), env({ LIMITER: limiter }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ text: 'Merhaba', provider: 'gemini' })
    expect(vi.mocked(console.warn)).toHaveBeenCalledWith('assistant: limiter failed')
  })

  it('returns 429 on the third request from one IP when RATE_LIMIT_PER_HOUR is 2', async () => {
    stubFetch(() => geminiReply('Merhaba'))
    const ip = nextIp()
    const limited = env({ RATE_LIMIT_PER_HOUR: '2' })

    const first = await worker.fetch(post(ip, validBody()), limited)
    const second = await worker.fetch(post(ip, validBody()), limited)
    const third = await worker.fetch(post(ip, validBody()), limited)

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(third.status).toBe(429)
    expect(await third.json()).toEqual({ error: 'rate_limited' })
  })
})
