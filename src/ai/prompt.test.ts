import { describe, it, expect } from 'vitest'
import { buildMessages, compactSummary, SYSTEM_PROMPT } from './prompt'
import type { AssistantRequest } from './protocol'
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
  accounts: [{ name: 'Örnek Kart', kind: 'kart', available: '20.000 ₺', limit: '30.000 ₺' }],
  categories: [],
  month: { spent: '0 ₺', lastMonthSamePeriod: '0 ₺', lastMonthTotal: '0 ₺', projected: '0 ₺', daysPassed: 10, daysInMonth: 31 },
  budgets: [],
  insights: [],
}

const request: AssistantRequest = {
  v: 1,
  summary,
  messages: [
    { role: 'user', text: 'Bu ay ne kadar harcayabilirim?' },
    { role: 'assistant', text: 'Şu an 24.500 ₺ harcayabilirsin.' },
    { role: 'user', text: 'Peki kartım?' },
  ],
}

describe('buildMessages', () => {
  it('starts the system prompt with SYSTEM_PROMPT', () => {
    const { system } = buildMessages(request)
    expect(system.startsWith(SYSTEM_PROMPT)).toBe(true)
  })

  it('embeds the summary as JSON after a fixed heading', () => {
    const { system } = buildMessages(request)
    expect(system).toContain('\n\nBütçe özeti (JSON):\n' + JSON.stringify(compactSummary(summary)))
  })

  it('embeds a summary that differs from the fixture', () => {
    const other = { ...summary, date: '2030-01-01' }
    const { system } = buildMessages({ ...request, summary: other })
    expect(system).toContain('"date":"2030-01-01"')
    expect(system).not.toContain('"date":"2026-03-10"')
  })

  it('returns the chat turns unchanged', () => {
    const { turns } = buildMessages(request)
    expect(turns).toEqual(request.messages)
    expect(turns).toHaveLength(3)
  })

  it('keeps the system prompt free of the raw user messages', () => {
    const { system } = buildMessages(request)
    expect(system).not.toContain('Peki kartım?')
  })
})

describe('compactSummary', () => {
  it('drops empty values only, at every level', () => {
    expect(
      compactSummary({ a: 0, b: '0 ₺', c: false, d: null, e: [], f: '12 ₺', g: true, h: [{ x: 0, y: 'Kart' }], i: { j: 0, k: 3 } }),
    ).toEqual({ f: '12 ₺', g: true, h: [{ y: 'Kart' }], i: { k: 3 } })
  })

  it('keeps every non-empty figure of the summary', () => {
    const text = JSON.stringify(compactSummary(summary))
    for (const figure of ['24.500 ₺', '20.000 ₺', '4.500 ₺', '1.200 ₺', '800 ₺', '22.500 ₺', '3.000 ₺', '30.000 ₺', 'Örnek Kart']) {
      expect(text).toContain(figure)
    }
    expect(text).not.toContain('"cash"')
    expect(text).not.toContain('"budgets"')
  })
})
