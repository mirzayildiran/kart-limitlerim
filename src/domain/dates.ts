import type { CycleKey, IsoDate } from './types'

/** Local midnight of the given moment. */
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function toIso(d: Date): IsoDate {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function fromIso(s: IsoDate): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}

/** Whole calendar days from b to a (a − b). DST-safe. */
export function daysBetween(a: Date, b: Date): number {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
  return Math.round((ua - ub) / 86_400_000)
}

/** The given day in year/month, clamped to the month's length (31 → 30 Nov). */
export function dayInMonth(year: number, month: number, day: number): Date {
  const length = new Date(year, month + 1, 0).getDate()
  return new Date(year, month, Math.min(day, length))
}

export function cycleKeyOf(d: Date): CycleKey {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function monthStart(key: CycleKey): Date {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1)
}

export function shiftMonth(key: CycleKey, delta: number): CycleKey {
  const d = monthStart(key)
  return cycleKeyOf(new Date(d.getFullYear(), d.getMonth() + delta, 1))
}

/** Weekend or official holiday → the next business day (see holidays.ts). */
export { nextBusinessDay } from './holidays'

const shortFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' })
const longFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long' })
const monthFmt = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' })

/** "8 Eki" */
export const formatShort = (d: Date) => shortFmt.format(d).replace(/ /g, ' ')
/** "8 Ekim" */
export const formatLong = (d: Date) => longFmt.format(d)
/** "Ekim 2026" */
export const formatMonth = (key: CycleKey) => monthFmt.format(monthStart(key))
