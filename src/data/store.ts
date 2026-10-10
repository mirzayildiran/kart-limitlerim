import { computed, signal } from '@preact/signals'
import { nextHue } from '../domain/categories'
import { startOfDay } from '../domain/dates'
import { closeCycle } from '../domain/interest'
import { byMostAvailable, isCard, isKmh, isLiquid, outlook, spendingPower, statementItems } from '../domain/power'
import { runway } from '../domain/runway'
import type { Account, Category, CategoryBudget, Expense, Kurus, MerchantRule, RecurringPayment } from '../domain/types'
import * as repo from './db'

/**
 * App state as signals. Components read the signals; mutations go through the
 * actions below, which write IndexedDB first and then update state.
 */

export const ready = signal(false)
export const loadError = signal<string | null>(null)

export const accounts = signal<Account[]>([])
export const expenses = signal<Expense[]>([])
export const categories = signal<Category[]>([])
export const recurring = signal<RecurringPayment[]>([])
export const rules = signal<MerchantRule[]>([])
/** The user's monthly spending targets, at most one per category. */
export const budgets = signal<CategoryBudget[]>([])

/** Re-evaluated on focus so date-based views roll over at midnight. */
export const today = signal(startOfDay(new Date()))

export const cards = computed(() => byMostAvailable(accounts.value.filter(isCard)))
export const kmhAccounts = computed(() => byMostAvailable(accounts.value.filter(isKmh)))
export const liquidAccounts = computed(() => byMostAvailable(accounts.value.filter(isLiquid)))
export const power = computed(() => spendingPower(accounts.value))
export const statements = computed(() => statementItems(accounts.value, today.value))
export const forecast = computed(() => outlook(accounts.value, recurring.value, today.value))
export const runwayDays = computed(() => runway(accounts.value, recurring.value, today.value))
export const activeCategories = computed(() =>
  categories.value.filter((c) => !c.archived).sort((a, b) => a.order - b.order),
)
export const categoryById = computed(() => new Map(categories.value.map((c) => [c.id, c])))
export const accountById = computed(() => new Map(accounts.value.map((a) => [a.id, a])))

let db: repo.Db | null = null

function requireDb(): repo.Db {
  if (!db) throw new Error('Veritabanı henüz açılmadı.')
  return db
}

export function newId(prefix: string): string {
  const rand = crypto.getRandomValues(new Uint32Array(2))
  return `${prefix}_${Date.now().toString(36)}${rand[0].toString(36)}${rand[1].toString(36)}`.slice(0, 32)
}

function hydrate(s: repo.Snapshot) {
  accounts.value = s.accounts
  expenses.value = s.expenses
  categories.value = s.categories
  recurring.value = s.recurring
  rules.value = s.rules
  budgets.value = s.budgets
}

export async function init(): Promise<void> {
  try {
    db = await repo.openAppDb()
    hydrate(await repo.loadAll(db))
    await closeCycles()
    // Ask the browser not to evict our data under storage pressure.
    navigator.storage?.persist?.().catch(() => {})
  } catch {
    loadError.value = 'Veriler açılamadı. Gizli sekmedeysen normal sekmede ya da ana ekrana eklenmiş uygulamada dene.'
  } finally {
    ready.value = true
  }
  const refreshDay = () => {
    const d = startOfDay(new Date())
    if (+d !== +today.value) {
      today.value = d
      closeCycles().catch(() => {})
    }
  }
  document.addEventListener('visibilitychange', refreshDay)
  window.addEventListener('focus', refreshDay)
}

/**
 * When a statement cut has passed, record the closed cycle's interest in the
 * card's history and reset the line for the new statement.
 */
async function closeCycles(): Promise<void> {
  if (!db) return
  for (const a of accounts.value) {
    if (a.kind !== 'card') continue
    const lines = a.lines.map((l) => closeCycle(l, a, today.value))
    if (lines.every((l, i) => l === a.lines[i])) continue
    const next = { ...a, lines }
    await repo.putAccount(db, next)
    accounts.value = upsert(accounts.value, next)
  }
}

const upsert = <T extends { id: string }>(list: T[], item: T) => {
  const i = list.findIndex((x) => x.id === item.id)
  return i < 0 ? [...list, item] : list.map((x, j) => (j === i ? item : x))
}
const mergeAccounts = (changed: Account[]) => {
  let next = accounts.value
  for (const a of changed) next = upsert(next, a)
  accounts.value = next
}

// ---- accounts ----
export async function saveAccount(a: Account): Promise<void> {
  const next = { ...a, updatedAt: Date.now() }
  await repo.putAccount(requireDb(), next)
  accounts.value = upsert(accounts.value, next)
}

export async function removeAccount(id: string): Promise<void> {
  await repo.deleteAccount(requireDb(), id)
  accounts.value = accounts.value.filter((a) => a.id !== id)
}

// ---- expenses ----
export async function saveExpense(before: Expense | null, after: Expense): Promise<void> {
  const changed = await repo.writeExpense(requireDb(), before, after)
  expenses.value = upsert(expenses.value, after)
  mergeAccounts(changed)
}

export async function removeExpense(e: Expense): Promise<void> {
  const changed = await repo.writeExpense(requireDb(), e, null)
  expenses.value = expenses.value.filter((x) => x.id !== e.id)
  mergeAccounts(changed)
}

export async function importExpenses(items: Expense[]): Promise<void> {
  const changed = await repo.writeExpenses(requireDb(), items)
  let next = expenses.value
  for (const e of items) next = upsert(next, e)
  expenses.value = next
  mergeAccounts(changed)
}

// ---- categories ----
export async function createCategory(name: string): Promise<Category> {
  const c: Category = {
    id: newId('cat'),
    name: name.trim(),
    hue: nextHue(categories.value),
    builtin: false,
    order: Math.max(0, ...categories.value.map((x) => x.order)) + 1,
  }
  await repo.putCategory(requireDb(), c)
  categories.value = upsert(categories.value, c)
  return c
}

export async function saveCategory(c: Category): Promise<void> {
  await repo.putCategory(requireDb(), c)
  categories.value = upsert(categories.value, c)
}

// ---- recurring ----
export async function saveRecurring(r: RecurringPayment): Promise<void> {
  await repo.putRecurring(requireDb(), r)
  recurring.value = upsert(recurring.value, r)
}

export async function removeRecurring(id: string): Promise<void> {
  await repo.deleteRecurring(requireDb(), id)
  recurring.value = recurring.value.filter((r) => r.id !== id)
}

// ---- merchant rules ----
export async function saveRule(r: MerchantRule): Promise<void> {
  await repo.putRule(requireDb(), r)
  rules.value = upsert(rules.value, r)
}

// ---- budgets ----
/**
 * Set a category's monthly target. `null` or a value of 0 or less removes it.
 * Amounts are rounded to whole kuruş so the stored value always loads back.
 */
export async function saveBudget(categoryId: string, monthly: Kurus | null): Promise<void> {
  const amount = monthly === null ? 0 : Math.round(monthly)
  let next: CategoryBudget[]
  if (!(amount > 0)) {
    next = budgets.value.filter((b) => b.categoryId !== categoryId)
  } else if (budgets.value.some((b) => b.categoryId === categoryId)) {
    next = budgets.value.map((b) => (b.categoryId === categoryId ? { categoryId, monthly: amount } : b))
  } else {
    next = [...budgets.value, { categoryId, monthly: amount }]
  }
  await repo.putBudgets(requireDb(), next)
  budgets.value = next
}

// ---- backup ----
// The backup code (format, record checks) loads on first use, not with the app.
const backupModule = () => import('./backup')

export async function exportBackupText(): Promise<string> {
  const { serializeBackup } = await backupModule()
  return serializeBackup(await repo.loadAll(requireDb()))
}

export async function importBackupText(text: string): Promise<void> {
  const { parseBackup, restoreBackup } = await backupModule()
  const backup = parseBackup(text)
  await restoreBackup(requireDb(), backup)
  hydrate(await repo.loadAll(requireDb()))
}

/** One-time flags (onboarding prompts) kept in the meta store, so they travel with a backup reset. */
export async function getFlag(key: string): Promise<boolean> {
  return db ? (await repo.getMeta<boolean>(db, key)) === true : false
}

export async function setFlag(key: string): Promise<void> {
  if (db) await repo.setMeta(db, key, true)
}

/** Replaces this device's data with the sample data, dated relative to today. Loaded on demand. */
export async function loadDemoData(): Promise<void> {
  const [{ default: raw }, { shiftDemoBackup }, { parseBackup, restoreBackup }] = await Promise.all([
    import('./demo-backup.json'),
    import('./demo'),
    backupModule(),
  ])
  const backup = shiftDemoBackup(parseBackup(JSON.stringify(raw)), new Date())
  await restoreBackup(requireDb(), backup)
  hydrate(await repo.loadAll(requireDb()))
}

// ---- settings: categories, reset ----
/** Delete a user category. Refuses while any expense or recurring payment still uses it. */
export async function removeCategory(id: string): Promise<void> {
  const used = expenses.value.some((e) => e.categoryId === id) || recurring.value.some((r) => r.categoryId === id)
  if (used) throw new Error('Bu kategoriyle kayıtlı harcamalar var; arşivleyebilirsin.')
  await repo.deleteCategory(requireDb(), id)
  categories.value = categories.value.filter((c) => c.id !== id)
  if (budgets.value.some((b) => b.categoryId === id)) {
    const next = budgets.value.filter((b) => b.categoryId !== id)
    await repo.putBudgets(requireDb(), next)
    budgets.value = next
  }
}

/** Erase everything on this device and start over with the default categories. */
export async function resetAllData(): Promise<void> {
  await repo.resetAll(requireDb())
  hydrate(await repo.loadAll(requireDb()))
}
