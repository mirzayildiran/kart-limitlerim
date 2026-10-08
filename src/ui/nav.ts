import { signal } from '@preact/signals'
import type { AccountKind, Expense } from '../domain/types'

/**
 * Navigation contract shared by all features.
 * Pages are hash routes; editors are bottom sheets opened through `openSheet`.
 */

export type Route = 'home' | 'expenses' | 'calendar' | 'settings'

export const ROUTES: Record<Route, string> = {
  home: '#/',
  expenses: '#/harcamalar',
  calendar: '#/takvim',
  settings: '#/ayarlar',
}

function parse(hash: string): Route {
  const found = (Object.keys(ROUTES) as Route[]).find((r) => ROUTES[r] === hash)
  return found ?? 'home'
}

export const route = signal<Route>(parse(location.hash))
window.addEventListener('hashchange', () => (route.value = parse(location.hash)))

export function go(r: Route) {
  if (location.hash !== ROUTES[r]) location.hash = ROUTES[r]
  window.scrollTo({ top: 0 })
}

/** Every editor in the app. Exactly one sheet is open at a time. */
export type SheetRequest =
  | { type: 'account'; id?: string; kind?: AccountKind }
  /** Read-only overview of one card/KMH/bank account with interest figures and an edit button. */
  | { type: 'accountDetail'; id: string }
  | { type: 'statement'; accountId: string; lineIndex: number }
  | { type: 'expense'; expense?: Expense; accountId?: string }
  | { type: 'recurring'; id?: string }
  | { type: 'category'; id?: string }
  | { type: 'import' }

export const sheet = signal<SheetRequest | null>(null)

export const openSheet = (req: SheetRequest) => (sheet.value = req)
export const closeSheet = () => (sheet.value = null)
