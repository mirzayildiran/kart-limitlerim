import { describe, expect, it } from 'vitest'
import { cycleKeyOf } from '../domain/dates'
import { lastCut } from '../domain/statement'
import { parseBackup } from './backup'
import raw from './demo-backup.json'
import { currentCycleKey, shiftDemoBackup } from './demo'

const demo = parseBackup(JSON.stringify(raw))

describe('demo backup', () => {
  it('is a valid backup with cards, expenses and recurring payments', () => {
    expect(demo.data.accounts.some((a) => a.kind === 'card')).toBe(true)
    expect(demo.data.expenses.length).toBeGreaterThan(0)
    expect(demo.data.recurring.length).toBeGreaterThan(0)
  })
})

describe('currentCycleKey', () => {
  it('matches lastCut from the statement domain for every day of a year and cut days 1, 15, 28, 31', () => {
    for (const cutDay of [1, 15, 28, 31]) {
      for (let d = 0; d < 366; d++) {
        const today = new Date(2026, 0, 1 + d)
        expect(currentCycleKey(cutDay, today)).toBe(cycleKeyOf(lastCut(cutDay, today)))
      }
    }
  })
})

describe('shiftDemoBackup', () => {
  const base = demo.exportedAt.slice(0, 10) // 2026-10-10

  it('keeps dates as they are when now is the export day', () => {
    const out = shiftDemoBackup(demo, new Date(2026, 9, 10, 12))
    expect(out.data.expenses.map((e) => e.date)).toEqual(demo.data.expenses.map((e) => e.date))
    expect(base).toBe('2026-10-10')
  })

  it('moves every expense, recurring and due date by the same number of days', () => {
    const out = shiftDemoBackup(demo, new Date(2027, 2, 1, 8)) // 142 days after 2026-10-10
    const days = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86_400_000
    demo.data.expenses.forEach((e, i) => expect(days(e.date, out.data.expenses[i].date)).toBe(142))
    demo.data.recurring.forEach((r, i) => expect(days(r.startDate, out.data.recurring[i].startDate)).toBe(142))
    demo.data.accounts.forEach((a, i) => {
      const after = out.data.accounts[i]
      if (a.kind !== 'card' || after.kind !== 'card') return
      a.lines.forEach((l, j) => {
        if (l.dueDate) expect(days(l.dueDate, after.lines[j].dueDate!)).toBe(142)
      })
    })
  })

  it('sets every card line to the current cycle and stamps exportedAt with now', () => {
    const now = new Date(2027, 2, 1, 8)
    const out = shiftDemoBackup(demo, now)
    expect(out.exportedAt).toBe(now.toISOString())
    for (const a of out.data.accounts) {
      if (a.kind !== 'card') continue
      for (const l of a.lines) expect(l.cycle).toBe(cycleKeyOf(lastCut(l.cutDay, now)))
    }
  })

  it('does not change its input', () => {
    const before = JSON.stringify(demo)
    shiftDemoBackup(demo, new Date(2027, 2, 1))
    expect(JSON.stringify(demo)).toBe(before)
  })

  it('still parses as a backup after shifting', () => {
    expect(() => parseBackup(JSON.stringify(shiftDemoBackup(demo, new Date(2027, 2, 1))))).not.toThrow()
  })
})
