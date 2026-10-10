import { describe, it, expect } from 'vitest'
import { reminderId, reminderPlan } from './reminders'
import type { CardAccount, CardLine } from './types'

const line: CardLine = {
  id: 'l1',
  label: 'Ana',
  cutDay: 3,
  dueOffsetDays: 10,
  cycle: '2026-10',
  statementDebt: 1_000_000,
  minimumDue: 200_000,
  dueDate: '2026-10-13',
  payment: 'unpaid',
}

const card = (lines: CardLine[], name = 'Kart A'): CardAccount => ({
  id: 'c1',
  kind: 'card',
  name,
  limit: 5_000_000,
  available: 3_000_000,
  lines,
  updatedAt: 0,
  createdAt: 0,
})

describe('reminderPlan', () => {
  it('reminds two days before and on the morning of the due date', () => {
    const plan = reminderPlan([card([line])], new Date(2026, 9, 10, 9, 0))
    expect(plan.map((r) => r.at)).toEqual([new Date(2026, 9, 11, 10), new Date(2026, 9, 13, 10)])
    expect(plan.map((r) => r.title)).toEqual(['Kart A son ödeme 2 gün sonra', 'Kart A son ödeme bugün'])
  })

  it('skips reminders whose time has passed', () => {
    const plan = reminderPlan([card([line])], new Date(2026, 9, 13, 11, 0))
    expect(plan).toEqual([])
  })

  it('keeps the due-day reminder when only the early one has passed', () => {
    const plan = reminderPlan([card([line])], new Date(2026, 9, 12, 8, 0))
    expect(plan).toHaveLength(1)
    expect(plan[0].title).toBe('Kart A son ödeme bugün')
  })

  it('does not remind for paid statements', () => {
    const plan = reminderPlan([card([{ ...line, payment: 'full' }])], new Date(2026, 9, 10))
    expect(plan).toEqual([])
  })

  it('names the line when a card has several', () => {
    const plan = reminderPlan([card([line, { ...line, id: 'l2', label: 'Dijital' }])], new Date(2026, 9, 12, 8))
    expect(plan.map((r) => r.title).sort()).toEqual(['Kart A Ana son ödeme bugün', 'Kart A Dijital son ödeme bugün'])
  })

  it('never puts amounts in the text', () => {
    for (const r of reminderPlan([card([line])], new Date(2026, 9, 10))) {
      expect(`${r.title} ${r.body}`).not.toMatch(/\d{3}|₺|TL/)
    }
  })

  it('gives each reminder a stable positive id', () => {
    const a = reminderPlan([card([line])], new Date(2026, 9, 10))
    const b = reminderPlan([card([line])], new Date(2026, 9, 10, 9, 30))
    expect(a.map((r) => r.id)).toEqual(b.map((r) => r.id))
    expect(new Set(a.map((r) => r.id)).size).toBe(a.length)
    expect(reminderId('x')).toBeGreaterThan(0)
    expect(reminderId('x')).toBeLessThanOrEqual(0x7fffffff)
  })
})
