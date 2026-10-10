import { describe, it, expect } from 'vitest'
import {
  assistantInput,
  canSend,
  DISCLAIMER,
  dueTag,
  insightIcon,
  PROVIDERS,
  QUICK_PROMPTS,
  severityLabel,
  severityTone,
} from './assistantModel'

describe('dueTag', () => {
  it('shows the days left as a warning', () => {
    expect(dueTag(3)).toEqual({ tone: 'warn', label: '3 gün' })
  })

  it('says Bugün on the due day', () => {
    expect(dueTag(0)).toEqual({ tone: 'warn', label: 'Bugün' })
  })

  it('shows the days past due as critical', () => {
    expect(dueTag(-2)).toEqual({ tone: 'crit', label: '2 gün geçti' })
  })
})

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
  it('has five quick prompts', () => {
    expect(QUICK_PROMPTS).toHaveLength(5)
    expect(QUICK_PROMPTS.every((p) => p.trim().length > 0)).toBe(true)
  })

  it('names every provider with a note', () => {
    expect(PROVIDERS.map((p) => p.name)).toEqual(['Google Gemini', 'Groq', 'OpenRouter'])
    expect(PROVIDERS.every((p) => p.note.length > 0)).toBe(true)
  })

  it('points Groq and OpenRouter users to the provider terms', () => {
    const notes = Object.fromEntries(PROVIDERS.map((p) => [p.name, p.note]))
    expect(notes['Groq']).toContain('Bu servisin kendi gizlilik ve saklama koşulları geçerlidir.')
    expect(notes['OpenRouter']).toContain('Bu servisin kendi gizlilik ve saklama koşulları geçerlidir.')
  })

  it('states that answers are estimates', () => {
    expect(DISCLAIMER).toBe('Tahmindir, finansal tavsiye değildir.')
  })
})

describe('insightIcon', () => {
  it('draws an alert for due dates, limits and shortfalls', () => {
    expect(insightIcon('statementDue')).toBe('alert')
    expect(insightIcon('cardNearLimit')).toBe('alert')
    expect(insightIcon('cashShortfall')).toBe('alert')
  })

  it('uses the card icon for card interest and the bank icon for KMH', () => {
    expect(insightIcon('minimumInterest')).toBe('card')
    expect(insightIcon('kmhInterest')).toBe('bank')
  })

  it('uses the wallet icon for spending pace and falls back to info', () => {
    expect(insightIcon('budgetOver')).toBe('wallet')
    expect(insightIcon('budgetPace')).toBe('wallet')
    expect(insightIcon('monthPace')).toBe('wallet')
    expect(insightIcon('categoryIncrease')).toBe('wallet')
    expect(insightIcon('bestCard')).toBe('info')
  })
})

describe('assistantInput', () => {
  it('passes the budget picture through unchanged', () => {
    const today = new Date(2026, 9, 10)
    const src = { accounts: [], expenses: [], categories: [], recurring: [], budgets: [], today }
    expect(assistantInput(src)).toEqual(src)
  })
})
