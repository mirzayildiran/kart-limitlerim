import { signal } from '@preact/signals'
import type { AccountKind, Expense } from '../domain/types'

/**
 * Navigation contract shared by all features.
 * Pages are hash routes; editors are bottom sheets opened through `openSheet`.
 */

export type Route = 'home' | 'expenses' | 'calendar' | 'settings' | 'assistant'

export const ROUTES: Record<Route, string> = {
  home: '#/',
  expenses: '#/harcamalar',
  calendar: '#/takvim',
  settings: '#/ayarlar',
  assistant: '#/asistan',
}

/** Tab order. A move to a later tab is "forward" and slides the page in from the right. */
const ORDER: Route[] = ['home', 'expenses', 'calendar', 'settings']

/** Sheet exit duration. Matches --dur-sheet-out in tokens.css. */
const SHEET_OUT_MS = 220

function parse(hash: string): Route {
  const found = (Object.keys(ROUTES) as Route[]).find((r) => ROUTES[r] === hash)
  return found ?? 'home'
}

export const route = signal<Route>(parse(location.hash))

/** True while the open sheet plays its exit animation. The sheet stays mounted until the exit ends. */
export const sheetClosing = signal(false)

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

let closeTimer: ReturnType<typeof setTimeout> | undefined

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function openSheet(req: SheetRequest) {
  // A sheet opened during an exit cancels that exit.
  clearTimeout(closeTimer)
  closeTimer = undefined
  sheetClosing.value = false
  sheet.value = req
}

/** Plays the exit, then unmounts the sheet. Calls during an exit do nothing. */
export function closeSheet() {
  if (sheet.value === null || closeTimer !== undefined) return
  if (reducedMotion()) {
    sheet.value = null
    return
  }
  sheetClosing.value = true
  closeTimer = setTimeout(() => {
    closeTimer = undefined
    sheetClosing.value = false
    sheet.value = null
  }, SHEET_OUT_MS)
}

let transition: ViewTransition | undefined

/**
 * The one place where the page route changes. With View Transitions the change is a
 * snapshot cross-fade/slide (CSS in app.css); without them it is a plain assignment.
 */
function setRoute(next: Route) {
  const prev = route.value
  if (next === prev || typeof document.startViewTransition !== 'function') {
    route.value = next
    window.scrollTo({ top: 0 })
    return
  }
  document.documentElement.dataset.nav = ORDER.indexOf(next) > ORDER.indexOf(prev) ? 'forward' : 'back'
  // A tap during a running transition ends it at once instead of queueing a second one.
  transition?.skipTransition()
  transition = document.startViewTransition(async () => {
    route.value = next
    window.scrollTo({ top: 0 })
    // Let Preact flush the render inside the snapshot.
    await new Promise((r) => setTimeout(r, 0))
  })
}

export function go(r: Route) {
  closeSheet()
  // A new hash fires `hashchange`, which runs setRoute. The same hash only needs a scroll.
  if (location.hash === ROUTES[r]) window.scrollTo({ top: 0 })
  else location.hash = ROUTES[r]
}

window.addEventListener('hashchange', () => {
  closeSheet()
  setRoute(parse(location.hash))
})
