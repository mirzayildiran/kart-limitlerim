import 'fake-indexeddb/auto'
import { describe, it, expect, afterEach } from 'vitest'
import { restoreBackup, makeBackup } from './backup'
import { cleanBudgets, getMeta, loadAll, openAppDb, putBudgets, resetAll, setMeta, type Db, type Snapshot } from './db'

const opened: Db[] = []

async function freshDb(): Promise<Db> {
  const db = await openAppDb('test-' + Math.random())
  opened.push(db)
  return db
}

const snapshot = (budgets: Snapshot['budgets'] = []): Snapshot => ({
  accounts: [{ id: 'acc-bank', kind: 'bank', name: 'Örnek Banka', balance: 250000, updatedAt: 1, createdAt: 1 }],
  expenses: [],
  categories: [{ id: 'cat-market', name: 'Market', hue: 120, builtin: true, order: 1 }],
  recurring: [],
  rules: [],
  budgets,
})

afterEach(() => {
  for (const db of opened.splice(0)) db.close()
})

describe('budgets in the database', () => {
  it('loadAll returns an empty budget list on a new database', async () => {
    const db = await freshDb()
    expect((await loadAll(db)).budgets).toEqual([])
  })

  it('putBudgets then loadAll round-trips the list', async () => {
    const db = await freshDb()
    const list = [
      { categoryId: 'cat-market', monthly: 500000 },
      { categoryId: 'cat-fun', monthly: 120000 },
    ]
    await putBudgets(db, list)
    expect((await loadAll(db)).budgets).toEqual(list)
  })

  it('loadAll drops malformed stored budgets', async () => {
    const db = await freshDb()
    await setMeta(db, 'budgets', [{ categoryId: 'cat-market', monthly: 10 }, { categoryId: '', monthly: 10 }, 'junk'])
    expect((await loadAll(db)).budgets).toEqual([{ categoryId: 'cat-market', monthly: 10 }])
  })

  it('resetAll clears budgets', async () => {
    const db = await freshDb()
    await putBudgets(db, [{ categoryId: 'cat-market', monthly: 500000 }])
    await resetAll(db)
    expect((await loadAll(db)).budgets).toEqual([])
  })

  it('restoreBackup writes budgets and leaves other meta keys alone', async () => {
    const db = await freshDb()
    await putBudgets(db, [{ categoryId: 'cat-old', monthly: 1000 }])
    await setMeta(db, 'other', 42)

    await restoreBackup(db, makeBackup(snapshot([{ categoryId: 'cat-market', monthly: 500000 }])))

    expect((await loadAll(db)).budgets).toEqual([{ categoryId: 'cat-market', monthly: 500000 }])
    expect(await getMeta(db, 'other')).toBe(42)
  })

  it('restoreBackup with no budgets clears the stored ones', async () => {
    const db = await freshDb()
    await putBudgets(db, [{ categoryId: 'cat-old', monthly: 1000 }])

    await restoreBackup(db, makeBackup(snapshot([])))

    expect((await loadAll(db)).budgets).toEqual([])
  })
})

describe('cleanBudgets', () => {
  it('returns an empty list for anything that is not an array', () => {
    expect(cleanBudgets(undefined)).toEqual([])
    expect(cleanBudgets(null)).toEqual([])
    expect(cleanBudgets({ categoryId: 'cat-market', monthly: 1 })).toEqual([])
  })

  it('keeps only non-empty string categoryIds with whole kuruş above zero', () => {
    expect(
      cleanBudgets([
        { categoryId: 'cat-a', monthly: 100 },
        { categoryId: '', monthly: 100 },
        { categoryId: 'cat-b', monthly: 0 },
        { categoryId: 'cat-c', monthly: -5 },
        { categoryId: 'cat-d', monthly: 2.5 },
        { categoryId: 'cat-e', monthly: NaN },
        { categoryId: 42, monthly: 100 },
        { categoryId: 'cat-f', monthly: '100' },
        { monthly: 100 },
        'cat-g',
        null,
      ]),
    ).toEqual([{ categoryId: 'cat-a', monthly: 100 }])
  })

  it('keeps the last entry when a category appears more than once', () => {
    expect(
      cleanBudgets([
        { categoryId: 'cat-a', monthly: 100 },
        { categoryId: 'cat-b', monthly: 200 },
        { categoryId: 'cat-a', monthly: 300 },
      ]),
    ).toEqual([
      { categoryId: 'cat-b', monthly: 200 },
      { categoryId: 'cat-a', monthly: 300 },
    ])
  })

  it('copies only categoryId and monthly from each entry', () => {
    expect(cleanBudgets([{ categoryId: 'cat-a', monthly: 100, note: 'extra' }])).toEqual([
      { categoryId: 'cat-a', monthly: 100 },
    ])
  })
})
