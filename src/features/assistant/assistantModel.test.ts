import { describe, it, expect } from 'vitest'
import {
  canSend,
  DISCLAIMER,
  PROVIDERS,
  QUICK_PROMPTS,
  severityLabel,
  severityTone,
} from './assistantModel'

describe('severityTone and severityLabel', () => {
  it('maps crit to Acil and crit tone', () => {
    expect(severityTone('crit')).toBe('crit')
    expect(severityLabel('crit')).toBe('Acil')
  })

  it('maps warn to Dikkat and warn tone', () => {
    expect(severityTone('warn')).toBe('warn')
    expect(severityLabel('warn')).toBe('Dikkat')
  })

  it('maps info to Öneri and accent tone', () => {
    expect(severityTone('info')).toBe('accent')
    expect(severityLabel('info')).toBe('Öneri')
  })
})

describe('canSend', () => {
  it('accepts a non-blank message while idle', () => {
    expect(canSend('Bu ay nasılım?', false)).toBe(true)
  })

  it('rejects an empty or whitespace-only message', () => {
    expect(canSend('', false)).toBe(false)
    expect(canSend('   \n\t ', false)).toBe(false)
  })

  it('rejects anything while a reply is pending', () => {
    expect(canSend('Merhaba', true)).toBe(false)
  })

  it('accepts exactly 1000 characters and rejects 1001', () => {
    expect(canSend('a'.repeat(1000), false)).toBe(true)
    expect(canSend('a'.repeat(1001), false)).toBe(false)
  })

  it('measures length after trimming', () => {
    expect(canSend(`  ${'a'.repeat(1000)}  `, false)).toBe(true)
  })
})

describe('static copy', () => {
  it('has four quick prompts', () => {
    expect(QUICK_PROMPTS).toHaveLength(5)
    expect(QUICK_PROMPTS.every((p) => p.trim().length > 0)).toBe(true)
  })

  it('names every provider with a note', () => {
    expect(PROVIDERS.map((p) => p.name)).toEqual(['Google Gemini', 'Groq', 'OpenRouter'])
    expect(PROVIDERS.every((p) => p.note.length > 0)).toBe(true)
  })

  it('states that answers are estimates', () => {
    expect(DISCLAIMER).toBe('Tahmindir, finansal tavsiye değildir.')
  })
})
