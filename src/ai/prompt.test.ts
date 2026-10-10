import { describe, it, expect } from 'vitest'
import { buildMessages, SYSTEM_PROMPT } from './prompt'
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
    expect(system).toContain('\n\nKullanıcının bütçe özeti (JSON):\n' + JSON.stringify(summary))
  })

  it('embeds a summary that differs from the fixture', () => {
    const other = { ...summary, date: '2030-01-01' }
    const { system } = buildMessages({ ...request, summary: other })
    expect(system).toContain(JSON.stringify(other))
    expect(system).not.toContain(JSON.stringify(summary))
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
