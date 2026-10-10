import { describe, it, expect, vi, afterEach } from 'vitest'
import { askAssistant, AssistantError, errorMessage, trimHistory } from './client'
import { LIMITS } from './protocol'
import type { AssistantErrorCode, ChatMessage } from './protocol'
import type { BudgetSummary } from '../domain/insightsTypes'

const summary: BudgetSummary = {
  date: '2026-03-10',
  power: { total: '24.500 ₺', cards: '20.000 ₺', kmh: '4.500 ₺', cash: '0 ₺' },
  outlook: {
    until: '2026-04-05',
    days: 26,
    minimums: '1.200 ₺',
    unknownMinimums: 0,
    recurring: '800 ₺',
    powerAfter: '22.500 ₺',
    cashAfter: '3.000 ₺',
    shortfall: false,
  },
  accounts: [],
  categories: [],
  month: { spent: '0 ₺', lastMonthSamePeriod: '0 ₺', lastMonthTotal: '0 ₺', projected: '0 ₺', daysPassed: 10, daysInMonth: 31 },
  budgets: [],
  insights: [],
}

const messages: ChatMessage[] = [{ role: 'user', text: 'Ne kadar harcayabilirim?' }]
const URL = 'https://proxy.example.test/'

type Handler = (url: string, init: RequestInit | undefined) => Response | Promise<Response>

/** Fake fetch that records the calls it receives. */
function fakeFetch(handler: Handler): { fetchImpl: typeof fetch; calls: { url: string; init: RequestInit | undefined }[] } {
  const calls: { url: string; init: RequestInit | undefined }[] = []
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init })
    return handler(String(input), init)
  }) as typeof fetch
  return { fetchImpl, calls }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

async function errorOf(promise: Promise<unknown>): Promise<AssistantError> {
  try {
    await promise
  } catch (err) {
    if (err instanceof AssistantError) return err
    throw new Error('expected an AssistantError, got ' + String(err))
  }
  throw new Error('expected rejection')
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('askAssistant', () => {
  it('throws not_configured when the URL is null', async () => {
    const { fetchImpl, calls } = fakeFetch(() => json({ text: 'x', provider: 'gemini' }))
    const err = await errorOf(askAssistant(summary, messages, { url: null, fetchImpl }))
    expect(err.code).toBe('not_configured')
    expect(calls).toHaveLength(0)
  })

  it('throws not_configured when the URL is empty', async () => {
    const { fetchImpl } = fakeFetch(() => json({ text: 'x', provider: 'gemini' }))
    const err = await errorOf(askAssistant(summary, messages, { url: '', fetchImpl }))
    expect(err.code).toBe('not_configured')
  })

  it('POSTs v, summary and trimmed messages as JSON', async () => {
    const { fetchImpl, calls } = fakeFetch(() => json({ text: 'Tamam', provider: 'groq' }))
    await askAssistant(summary, messages, { url: URL, fetchImpl })

    expect(calls).toHaveLength(1)
    const { url, init } = calls[0]
    expect(url).toBe(URL)
    expect(init?.method).toBe('POST')
    expect(new Headers(init?.headers).get('content-type')).toBe('application/json')
    expect(JSON.parse(String(init?.body))).toEqual({ v: 1, summary, messages })
  })

  it('returns text and provider on success', async () => {
    const { fetchImpl } = fakeFetch(() => json({ text: 'Şu an 24.500 ₺ harcayabilirsin.', provider: 'gemini' }))
    const reply = await askAssistant(summary, messages, { url: URL, fetchImpl })
    expect(reply).toEqual({ text: 'Şu an 24.500 ₺ harcayabilirsin.', provider: 'gemini' })
  })

  it('sends the timeout signal', async () => {
    const { fetchImpl, calls } = fakeFetch(() => json({ text: 'x', provider: 'gemini' }))
    await askAssistant(summary, messages, { url: URL, fetchImpl })
    expect(calls[0].init?.signal).toBeInstanceOf(AbortSignal)
  })

  it('maps HTTP 429 to rate_limited', async () => {
    const { fetchImpl } = fakeFetch(() => json({ error: 'rate_limited' }, 429))
    expect((await errorOf(askAssistant(summary, messages, { url: URL, fetchImpl }))).code).toBe('rate_limited')
  })

  it('maps HTTP 400 to bad_request', async () => {
    const { fetchImpl } = fakeFetch(() => json({ error: 'bad_request' }, 400))
    expect((await errorOf(askAssistant(summary, messages, { url: URL, fetchImpl }))).code).toBe('bad_request')
  })

  it('maps HTTP 403 (origin not allowed) to not_configured, not bad_request', async () => {
    const { fetchImpl } = fakeFetch(() => json({ error: 'bad_request' }, 403))
    expect((await errorOf(askAssistant(summary, messages, { url: URL, fetchImpl }))).code).toBe('not_configured')
  })

  it('uses a known error code from the body for other failures', async () => {
    const { fetchImpl } = fakeFetch(() => json({ error: 'not_configured' }, 503))
    expect((await errorOf(askAssistant(summary, messages, { url: URL, fetchImpl }))).code).toBe('not_configured')
  })

  it('maps an unknown error code in the body to unavailable', async () => {
    const { fetchImpl } = fakeFetch(() => json({ error: 'something_else' }, 500))
    expect((await errorOf(askAssistant(summary, messages, { url: URL, fetchImpl }))).code).toBe('unavailable')
  })

  it('maps a non-OK response without a JSON body to unavailable', async () => {
    const { fetchImpl } = fakeFetch(() => new Response('<html>Bad gateway</html>', { status: 502 }))
    expect((await errorOf(askAssistant(summary, messages, { url: URL, fetchImpl }))).code).toBe('unavailable')
  })

  it('maps an OK body without a string text to unavailable', async () => {
    const { fetchImpl } = fakeFetch(() => json({ provider: 'gemini' }))
    expect((await errorOf(askAssistant(summary, messages, { url: URL, fetchImpl }))).code).toBe('unavailable')
  })

  it('maps an OK body with empty text to unavailable', async () => {
    const { fetchImpl } = fakeFetch(() => json({ text: '   ', provider: 'gemini' }))
    expect((await errorOf(askAssistant(summary, messages, { url: URL, fetchImpl }))).code).toBe('unavailable')
  })

  it('maps an OK body without a string provider to unavailable', async () => {
    const { fetchImpl } = fakeFetch(() => json({ text: 'x', provider: 3 }))
    expect((await errorOf(askAssistant(summary, messages, { url: URL, fetchImpl }))).code).toBe('unavailable')
  })

  it('maps an OK body that is not an object to unavailable', async () => {
    const { fetchImpl } = fakeFetch(() => json(['x']))
    expect((await errorOf(askAssistant(summary, messages, { url: URL, fetchImpl }))).code).toBe('unavailable')
  })

  it('maps an OK body that is not JSON to unavailable', async () => {
    const { fetchImpl } = fakeFetch(() => new Response('plain text', { status: 200 }))
    expect((await errorOf(askAssistant(summary, messages, { url: URL, fetchImpl }))).code).toBe('unavailable')
  })

  it('maps a TypeError from fetch to offline', async () => {
    const { fetchImpl } = fakeFetch(() => {
      throw new TypeError('Failed to fetch')
    })
    expect((await errorOf(askAssistant(summary, messages, { url: URL, fetchImpl }))).code).toBe('offline')
  })

  it('maps any other error from fetch to unavailable', async () => {
    const { fetchImpl } = fakeFetch(() => {
      throw new Error('boom')
    })
    expect((await errorOf(askAssistant(summary, messages, { url: URL, fetchImpl }))).code).toBe('unavailable')
  })

  it('does not call fetch and maps to offline when navigator reports offline', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    const { fetchImpl, calls } = fakeFetch(() => json({ text: 'x', provider: 'gemini' }))
    expect((await errorOf(askAssistant(summary, messages, { url: URL, fetchImpl }))).code).toBe('offline')
    expect(calls).toHaveLength(0)
  })

  it('calls fetch when navigator reports online', async () => {
    vi.stubGlobal('navigator', { onLine: true })
    const { fetchImpl, calls } = fakeFetch(() => json({ text: 'x', provider: 'gemini' }))
    await askAssistant(summary, messages, { url: URL, fetchImpl })
    expect(calls).toHaveLength(1)
  })

  it('maps a slow request to timeout', async () => {
    const hang = ((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      })) as typeof fetch
    const err = await errorOf(askAssistant(summary, messages, { url: URL, fetchImpl: hang, timeoutMs: 5 }))
    expect(err.code).toBe('timeout')
  })

  it('rethrows the caller abort unchanged', async () => {
    const controller = new AbortController()
    const hang = ((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      })) as typeof fetch
    const pending = askAssistant(summary, messages, { url: URL, fetchImpl: hang, signal: controller.signal })
    controller.abort()
    const reason = await pending.then(
      () => null,
      (e: unknown) => e,
    )
    expect(reason).not.toBeInstanceOf(AssistantError)
    expect(reason).toBeInstanceOf(DOMException)
    expect((reason as DOMException).name).toBe('AbortError')
  })

  it('aborts immediately when the caller signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const seen: boolean[] = []
    const fetchImpl = ((_input: RequestInfo | URL, init?: RequestInit) => {
      seen.push(init?.signal?.aborted === true)
      return Promise.reject(new DOMException('aborted', 'AbortError'))
    }) as typeof fetch
    const reason = await askAssistant(summary, messages, { url: URL, fetchImpl, signal: controller.signal }).then(
      () => null,
      (e: unknown) => e,
    )
    expect(seen).toEqual([true])
    expect(reason).not.toBeInstanceOf(AssistantError)
  })
})

describe('trimHistory', () => {
  it('keeps the last maxMessages messages', () => {
    const many: ChatMessage[] = Array.from({ length: 15 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      text: `m${i}`,
    }))
    const trimmed = trimHistory(many)
    expect(trimmed.length).toBeLessThanOrEqual(LIMITS.maxMessages)
    expect(trimmed[trimmed.length - 1].text).toBe('m14')
  })

  it('drops a leading assistant message', () => {
    const trimmed = trimHistory([
      { role: 'assistant', text: 'Merhaba' },
      { role: 'user', text: 'Soru' },
    ])
    expect(trimmed).toEqual([{ role: 'user', text: 'Soru' }])
  })

  it('drops several leading assistant messages after the cut', () => {
    const many: ChatMessage[] = [
      { role: 'user', text: 'a' },
      ...Array.from({ length: LIMITS.maxMessages }, (_, i) => ({
        role: (i % 2 === 0 ? 'assistant' : 'user') as ChatMessage['role'],
        text: `x${i}`,
      })),
    ]
    const trimmed = trimHistory(many)
    expect(trimmed[0].role).toBe('user')
    expect(trimmed[trimmed.length - 1].text).toBe(many[many.length - 1].text)
  })

  it('returns an empty list when there is no user message', () => {
    expect(trimHistory([{ role: 'assistant', text: 'Merhaba' }])).toEqual([])
    expect(trimHistory([])).toEqual([])
  })

  it('truncates long texts to maxMessageChars', () => {
    const text = 'a'.repeat(LIMITS.maxMessageChars + 50)
    const [out] = trimHistory([{ role: 'user', text }])
    expect(out.text.length).toBe(LIMITS.maxMessageChars)
  })

  it('does not leave a lone high surrogate at the cut', () => {
    const text = 'a'.repeat(LIMITS.maxMessageChars - 1) + '😀'
    const [out] = trimHistory([{ role: 'user', text }])
    expect(out.text).toBe('a'.repeat(LIMITS.maxMessageChars - 1))
  })

  it('does not change the input array or its messages', () => {
    const input: ChatMessage[] = [{ role: 'user', text: 'a'.repeat(LIMITS.maxMessageChars + 1) }]
    const copy = structuredClone(input)
    const out = trimHistory(input)
    expect(input).toEqual(copy)
    expect(out).not.toBe(input)
    expect(out[0]).not.toBe(input[0])
  })
})

describe('errorMessage', () => {
  const codes: AssistantErrorCode[] = [
    'not_configured',
    'offline',
    'timeout',
    'rate_limited',
    'bad_request',
    'unavailable',
  ]

  it('has a non-empty Turkish message for every code', () => {
    const texts = codes.map((c) => errorMessage(c))
    for (const text of texts) expect(text.trim().length).toBeGreaterThan(0)
    expect(new Set(texts).size).toBe(codes.length)
  })

  it('gives the expected text for rate_limited', () => {
    expect(errorMessage('rate_limited')).toBe('Asistan şu an çok yoğun. Birkaç dakika sonra yeniden dene.')
  })
})

describe('AssistantError', () => {
  it('carries the code and a name', () => {
    const err = new AssistantError('timeout')
    expect(err).toBeInstanceOf(Error)
    expect(err.code).toBe('timeout')
    expect(err.name).toBe('AssistantError')
  })
})
