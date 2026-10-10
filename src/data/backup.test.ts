import { describe, it, expect } from 'vitest'
import { BackupError, makeBackup, parseBackup } from './backup'
import type { Snapshot } from './db'

const snapshot = (): Snapshot => ({
  accounts: [{ id: 'acc-bank', kind: 'bank', name: 'Örnek Banka', balance: 250000, updatedAt: 1, createdAt: 1 }],
  expenses: [],
  categories: [{ id: 'cat-market', name: 'Market', hue: 120, builtin: true, order: 1 }],
  recurring: [],
  rules: [],
  budgets: [{ categoryId: 'cat-market', monthly: 500000 }],
})

/** A backup file as an older app version wrote it: no budgets key. */
const legacyText = () => {
  const s = snapshot()
  const data = { accounts: s.accounts, expenses: s.expenses, categories: s.categories, recurring: s.recurring, rules: s.rules }
  return JSON.stringify({ app: 'kart-limitlerim', schema: 1, exportedAt: '2026-01-01T00:00:00.000Z', data })
}

const withBudgets = (budgets: unknown) =>
  JSON.stringify({
    app: 'kart-limitlerim',
    schema: 1,
    exportedAt: '2026-01-01T00:00:00.000Z',
    data: { ...snapshot(), budgets },
  })

describe('parseBackup budgets', () => {
  it('accepts an older backup without budgets and returns an empty list', () => {
    const backup = parseBackup(legacyText())
    expect(backup.data.budgets).toEqual([])
    expect(backup.data.accounts).toHaveLength(1)
  })

  it('accepts a valid backup with budgets', () => {
    const backup = parseBackup(withBudgets([{ categoryId: 'cat-market', monthly: 500000 }]))
    expect(backup.data.budgets).toEqual([{ categoryId: 'cat-market', monthly: 500000 }])
  })

  it('rejects budgets that are not an array', () => {
    expect(() => parseBackup(withBudgets('x'))).toThrow(BackupError)
    expect(() => parseBackup(withBudgets('x'))).toThrow('Yedek dosyası eksik ya da bozuk.')
    expect(() => parseBackup(withBudgets(null))).toThrow('Yedek dosyası eksik ya da bozuk.')
  })

  it('drops invalid budget entries and keeps the last duplicate', () => {
    const backup = parseBackup(
      withBudgets([
        { categoryId: '', monthly: 100 },
        { categoryId: 'cat-a', monthly: 0 },
        { categoryId: 'cat-b', monthly: 1.5 },
        { categoryId: 'cat-c', monthly: '5' },
        null,
        { monthly: 300 },
        { categoryId: 'cat-d', monthly: 300 },
        { categoryId: 'cat-d', monthly: 400 },
      ]),
    )
    expect(backup.data.budgets).toEqual([{ categoryId: 'cat-d', monthly: 400 }])
  })

  it('round-trips a backup made by makeBackup', () => {
    const original = makeBackup(snapshot(), new Date('2026-03-04T05:06:07.000Z'))
    const parsed = parseBackup(JSON.stringify(original))
    expect(parsed).toEqual(original)
  })
})
