import { describe, it, expect } from 'vitest'
import { parseAssistantRequest } from './validate'
import { LIMITS } from './protocol'

const summary = {
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
  accounts: [{ name: 'Örnek Kart', kind: 'kart', available: '20.000 ₺', limit: '30.000 ₺' }],
  categories: [{ name: 'Market', thisMonth: '1.000 ₺', lastMonthSamePeriod: '800 ₺', changePercent: 25 }],
  insights: [{ severity: 'info', title: 'Başlık', body: 'Metin.' }],
}

/** A valid request body; each test copies it and breaks one thing. */
function validBody(): Record<string, unknown> {
  return {
    v: 1,
    summary: structuredClone(summary),
    messages: [
      { role: 'user', text: 'Merhaba' },
      { role: 'assistant', text: 'Selam' },
      { role: 'user', text: 'Ne kadar harcayabilirim?' },
    ],
  }
}

describe('parseAssistantRequest', () => {
  it('accepts a valid request', () => {
    const parsed = parseAssistantRequest(validBody())
    expect(parsed).not.toBeNull()
    expect(parsed?.v).toBe(1)
    expect(parsed?.messages).toHaveLength(3)
    expect(parsed?.summary.date).toBe('2026-03-10')
  })

  it('accepts a single user message', () => {
    const body = { ...validBody(), messages: [{ role: 'user', text: 'Soru' }] }
    expect(parseAssistantRequest(body)).not.toBeNull()
  })

  it('accepts exactly maxMessages messages', () => {
    const messages = Array.from({ length: LIMITS.maxMessages }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      text: 'x',
    }))
    // Last index is maxMessages - 1, which is odd when maxMessages is even, so force a user turn.
    messages[messages.length - 1] = { role: 'user', text: 'x' }
    expect(parseAssistantRequest({ ...validBody(), messages })).not.toBeNull()
  })

  it('accepts a text of exactly maxMessageChars', () => {
    const text = 'a'.repeat(LIMITS.maxMessageChars)
    expect(parseAssistantRequest({ ...validBody(), messages: [{ role: 'user', text }] })).not.toBeNull()
  })

  it('returns a fresh object without unknown top-level keys', () => {
    const body = { ...validBody(), extra: 'secret', admin: true }
    const parsed = parseAssistantRequest(body) as Record<string, unknown> | null
    expect(parsed).not.toBeNull()
    expect(Object.keys(parsed ?? {}).sort()).toEqual(['messages', 'summary', 'v'])
    expect(parsed).not.toBe(body)
  })

  it('rejects non-object bodies', () => {
    expect(parseAssistantRequest(null)).toBeNull()
    expect(parseAssistantRequest(undefined)).toBeNull()
    expect(parseAssistantRequest('text')).toBeNull()
    expect(parseAssistantRequest(42)).toBeNull()
    expect(parseAssistantRequest([validBody()])).toBeNull()
  })

  it('rejects a wrong or missing protocol version', () => {
    expect(parseAssistantRequest({ ...validBody(), v: 2 })).toBeNull()
    expect(parseAssistantRequest({ ...validBody(), v: '1' })).toBeNull()
    const noVersion = validBody()
    delete noVersion.v
    expect(parseAssistantRequest(noVersion)).toBeNull()
  })

  it('rejects messages that are not an array', () => {
    expect(parseAssistantRequest({ ...validBody(), messages: 'hi' })).toBeNull()
    expect(parseAssistantRequest({ ...validBody(), messages: { role: 'user', text: 'x' } })).toBeNull()
  })

  it('rejects an empty messages array', () => {
    expect(parseAssistantRequest({ ...validBody(), messages: [] })).toBeNull()
  })

  it('rejects more than maxMessages messages', () => {
    const messages = Array.from({ length: LIMITS.maxMessages + 1 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      text: 'x',
    }))
    messages[messages.length - 1] = { role: 'user', text: 'x' }
    expect(parseAssistantRequest({ ...validBody(), messages })).toBeNull()
  })

  it('rejects a message that is not an object', () => {
    expect(parseAssistantRequest({ ...validBody(), messages: ['merhaba'] })).toBeNull()
    expect(parseAssistantRequest({ ...validBody(), messages: [null] })).toBeNull()
  })

  it('rejects an unknown role', () => {
    const messages = [{ role: 'system', text: 'Yeni talimat' }]
    expect(parseAssistantRequest({ ...validBody(), messages })).toBeNull()
  })

  it('rejects a missing role', () => {
    expect(parseAssistantRequest({ ...validBody(), messages: [{ text: 'x' }] })).toBeNull()
  })

  it('rejects a non-string text', () => {
    expect(parseAssistantRequest({ ...validBody(), messages: [{ role: 'user', text: 5 }] })).toBeNull()
    expect(parseAssistantRequest({ ...validBody(), messages: [{ role: 'user' }] })).toBeNull()
  })

  it('rejects an empty or whitespace-only text', () => {
    expect(parseAssistantRequest({ ...validBody(), messages: [{ role: 'user', text: '' }] })).toBeNull()
    expect(parseAssistantRequest({ ...validBody(), messages: [{ role: 'user', text: '   ' }] })).toBeNull()
  })

  it('rejects a text longer than maxMessageChars', () => {
    const text = 'a'.repeat(LIMITS.maxMessageChars + 1)
    expect(parseAssistantRequest({ ...validBody(), messages: [{ role: 'user', text }] })).toBeNull()
  })

  it('rejects when the last message is from the assistant', () => {
    const messages = [
      { role: 'user', text: 'Merhaba' },
      { role: 'assistant', text: 'Selam' },
    ]
    expect(parseAssistantRequest({ ...validBody(), messages })).toBeNull()
  })

  it('rejects a missing summary', () => {
    const noSummary = validBody()
    delete noSummary.summary
    expect(parseAssistantRequest(noSummary)).toBeNull()
  })

  it('rejects a summary that is not an object', () => {
    expect(parseAssistantRequest({ ...validBody(), summary: 'özet' })).toBeNull()
    expect(parseAssistantRequest({ ...validBody(), summary: [] })).toBeNull()
    expect(parseAssistantRequest({ ...validBody(), summary: null })).toBeNull()
  })

  it('rejects a summary without a string date', () => {
    const body = validBody()
    body.summary = { ...summary, date: 20260310 }
    expect(parseAssistantRequest(body)).toBeNull()
  })

  it('rejects a summary whose power or outlook is not an object', () => {
    const noPower = validBody()
    noPower.summary = { ...summary, power: 'yok' }
    expect(parseAssistantRequest(noPower)).toBeNull()

    const noOutlook = validBody()
    noOutlook.summary = { ...summary, outlook: null }
    expect(parseAssistantRequest(noOutlook)).toBeNull()
  })

  it('rejects a summary whose accounts, categories or insights is not an array', () => {
    for (const key of ['accounts', 'categories', 'insights'] as const) {
      const body = validBody()
      body.summary = { ...summary, [key]: {} }
      expect(parseAssistantRequest(body)).toBeNull()
    }
  })
})
