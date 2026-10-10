import type { BackupFile } from './backup'

/**
 * Sample data for "Örnek verilerle dene" and for scripts/shots.mjs.
 * Self-contained on purpose (type imports only) so Node can load this file directly.
 */

const DAY_MS = 86_400_000

const dayNumber = (y: number, m: number, d: number): number => Date.UTC(y, m, d) / DAY_MS
const isoOf = (y: number, m: number, d: number): string => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10)
const parseIso = (s: string): [number, number, number] => {
  const [y, m, d] = s.split('-').map(Number)
  return [y, m, d]
}
const pad = (n: number): string => String(n).padStart(2, '0')

/** Cycle key of the latest statement cut on or before `today`; same rule as lastCut in src/domain/statement.ts. */
export function currentCycleKey(cutDay: number, today: Date): string {
  const y = today.getFullYear()
  const m = today.getMonth()
  const thisCut = new Date(y, m, Math.min(cutDay, new Date(y, m + 1, 0).getDate()))
  const cut = thisCut <= today ? thisCut : new Date(y, m - 1, Math.min(cutDay, new Date(y, m, 0).getDate()))
  return `${cut.getFullYear()}-${pad(cut.getMonth() + 1)}`
}

/**
 * The sample backup is written for the day in `exportedAt`. Moves every date by the same number
 * of days so the sample stays relative to `now`, recomputes card cycles for today and stamps
 * exportedAt with `now`. Does not change the input.
 */
export function shiftDemoBackup(backup: BackupFile, now: Date): BackupFile {
  const [by, bm, bd] = parseIso(backup.exportedAt.slice(0, 10))
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const delta = dayNumber(today.getFullYear(), today.getMonth(), today.getDate()) - dayNumber(by, bm - 1, bd)
  const shift = <T extends string | null | undefined>(s: T): T => {
    if (!s) return s
    const [y, m, d] = parseIso(s)
    return isoOf(y, m - 1, d + delta) as T
  }
  const data = structuredClone(backup.data)
  data.expenses = data.expenses.map((e) => ({ ...e, date: shift(e.date) }))
  data.recurring = data.recurring.map((r) => ({
    ...r,
    startDate: shift(r.startDate),
    handledThrough: shift(r.handledThrough),
    end: r.end.type === 'until' ? { ...r.end, date: shift(r.end.date) } : r.end,
  }))
  data.accounts = data.accounts.map((a) =>
    a.kind === 'card'
      ? { ...a, lines: a.lines.map((l) => ({ ...l, dueDate: shift(l.dueDate), cycle: currentCycleKey(l.cutDay, today) })) }
      : a,
  )
  return { ...backup, exportedAt: now.toISOString(), data }
}
