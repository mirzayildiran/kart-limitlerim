import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { DEFAULT_CATEGORIES } from '../domain/categories'
import { applyDelta, expenseDeltas } from '../domain/ledger'
import type { Account, Category, CategoryBudget, Expense, MerchantRule, RecurringPayment } from '../domain/types'

/** Everything lives on the device. No network, no account. */

interface Schema extends DBSchema {
  accounts: { key: string; value: Account }
  expenses: { key: string; value: Expense; indexes: { byDate: string; byAccount: string } }
  categories: { key: string; value: Category }
  recurring: { key: string; value: RecurringPayment }
  rules: { key: string; value: MerchantRule }
  meta: { key: string; value: { key: string; value: unknown } }
}

export const DB_NAME = 'kart-limitlerim'
export const DB_VERSION = 1

export type Db = IDBPDatabase<Schema>

export async function openAppDb(name = DB_NAME): Promise<Db> {
  const db = await openDB<Schema>(name, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('accounts', { keyPath: 'id' })
        const ex = db.createObjectStore('expenses', { keyPath: 'id' })
        ex.createIndex('byDate', 'date')
        ex.createIndex('byAccount', 'accountId')
        db.createObjectStore('categories', { keyPath: 'id' })
        db.createObjectStore('recurring', { keyPath: 'id' })
        db.createObjectStore('rules', { keyPath: 'id' })
        db.createObjectStore('meta', { keyPath: 'key' })
      }
    },
  })
  if ((await db.count('categories')) === 0) {
    const tx = db.transaction('categories', 'readwrite')
    await Promise.all([...DEFAULT_CATEGORIES.map((c) => tx.store.put(c)), tx.done])
  }
  return db
}

export interface Snapshot {
  accounts: Account[]
  expenses: Expense[]
  categories: Category[]
  recurring: RecurringPayment[]
  rules: MerchantRule[]
  budgets: CategoryBudget[]
}

/**
 * Keep only well-formed budget entries: a non-empty categoryId and a whole
 * kuruş amount above zero. When a category appears more than once, the last
 * entry wins. Anything that is not an array yields an empty list.
 */
export function cleanBudgets(raw: unknown): CategoryBudget[] {
  if (!Array.isArray(raw)) return []
  const byCategory = new Map<string, CategoryBudget>()
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    const { categoryId, monthly } = item as { categoryId?: unknown; monthly?: unknown }
    if (typeof categoryId !== 'string' || categoryId === '') continue
    if (typeof monthly !== 'number' || !Number.isInteger(monthly) || monthly <= 0) continue
    byCategory.delete(categoryId)
    byCategory.set(categoryId, { categoryId, monthly })
  }
  return [...byCategory.values()]
}

export async function loadAll(db: Db): Promise<Snapshot> {
  const [accounts, expenses, categories, recurring, rules, budgets] = await Promise.all([
    db.getAll('accounts'),
    db.getAll('expenses'),
    db.getAll('categories'),
    db.getAll('recurring'),
    db.getAll('rules'),
    getMeta<unknown>(db, 'budgets'),
  ])
  return { accounts, expenses, categories, recurring, rules, budgets: cleanBudgets(budgets) }
}

export const putAccount = (db: Db, a: Account) => db.put('accounts', a).then(() => a)
export const putCategory = (db: Db, c: Category) => db.put('categories', c).then(() => c)
export const putRecurring = (db: Db, r: RecurringPayment) => db.put('recurring', r).then(() => r)
export const putRule = (db: Db, r: MerchantRule) => db.put('rules', r).then(() => r)
export const deleteRecurring = (db: Db, id: string) => db.delete('recurring', id)
export const putBudgets = (db: Db, list: CategoryBudget[]) => setMeta(db, 'budgets', list)

/** Delete an account. Its expenses stay, labelled as from a removed account. */
export const deleteAccount = (db: Db, id: string) => db.delete('accounts', id)

/**
 * Save, change or remove an expense and adjust the affected accounts in one
 * transaction, so a crash can never leave a limit out of step with its records.
 * Pass `before = null` to create and `after = null` to delete.
 * Returns the accounts that changed.
 */
export async function writeExpense(db: Db, before: Expense | null, after: Expense | null): Promise<Account[]> {
  const tx = db.transaction(['expenses', 'accounts'], 'readwrite')
  const accounts = tx.objectStore('accounts')
  const changed: Account[] = []
  const now = Date.now()
  for (const [id, delta] of expenseDeltas(before, after)) {
    const acc = await accounts.get(id)
    if (!acc) continue
    const next = { ...applyDelta(acc, delta), updatedAt: now }
    await accounts.put(next)
    changed.push(next)
  }
  const expenses = tx.objectStore('expenses')
  if (after) await expenses.put(after)
  else if (before) await expenses.delete(before.id)
  await tx.done
  return changed
}

/** Import many expenses at once (screenshot import), adjusting accounts atomically. */
export async function writeExpenses(db: Db, items: Expense[]): Promise<Account[]> {
  const tx = db.transaction(['expenses', 'accounts'], 'readwrite')
  const accounts = tx.objectStore('accounts')
  const totals = new Map<string, number>()
  for (const e of items) {
    for (const [id, d] of expenseDeltas(null, e)) totals.set(id, (totals.get(id) ?? 0) + d)
    await tx.objectStore('expenses').put(e)
  }
  const changed: Account[] = []
  const now = Date.now()
  for (const [id, delta] of totals) {
    const acc = await accounts.get(id)
    if (!acc) continue
    const next = { ...applyDelta(acc, delta), updatedAt: now }
    await accounts.put(next)
    changed.push(next)
  }
  await tx.done
  return changed
}

export async function getMeta<T>(db: Db, key: string): Promise<T | undefined> {
  return (await db.get('meta', key))?.value as T | undefined
}

export async function setMeta(db: Db, key: string, value: unknown): Promise<void> {
  await db.put('meta', { key, value })
}

export const deleteCategory = (db: Db, id: string) => db.delete('categories', id)

/** Wipe every store and re-seed the default categories, all in one transaction. */
export async function resetAll(db: Db): Promise<void> {
  const tx = db.transaction(['accounts', 'expenses', 'categories', 'recurring', 'rules', 'meta'], 'readwrite')
  const ops = [
    tx.objectStore('accounts').clear(),
    tx.objectStore('expenses').clear(),
    tx.objectStore('categories').clear(),
    tx.objectStore('recurring').clear(),
    tx.objectStore('rules').clear(),
    tx.objectStore('meta').clear(),
    ...DEFAULT_CATEGORIES.map((c) => tx.objectStore('categories').put(c)),
  ]
  await Promise.all([...ops, tx.done])
}
