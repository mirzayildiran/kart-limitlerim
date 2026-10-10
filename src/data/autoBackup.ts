import { normalizeSnapshot, parseBackup, serializeBackup, type BackupFile } from './backup'
import type { Snapshot } from './db'

/**
 * Automatic on-device backup for the iOS app. IndexedDB inside WKWebView can be evicted by
 * iOS (see docs/ARCHITECTURE.md, "Veri dayanıklılığı"), so every meaningful change is also
 * written, in the normal backup format, to the app's own Library folder. Three copies rotate:
 * newest first. Pure logic; the file access is passed in (src/data/autoBackupRuntime.ts).
 */

export const AUTO_BACKUP_FILES = [
  'autobackup/autobackup.json',
  'autobackup/autobackup.1.json',
  'autobackup/autobackup.2.json',
] as const

export const AUTO_BACKUP_DELAY_MS = 5_000

/** The few file operations the backup needs. Paths are relative to one private folder. */
export interface BackupFiles {
  /** File contents, or null when the file does not exist. */
  read(path: string): Promise<string | null>
  write(path: string, text: string): Promise<void>
  remove(path: string): Promise<void>
}

/** Anything the user entered. Categories and rules alone are defaults, not user data. */
export function hasUserData(s: Snapshot): boolean {
  return s.accounts.length > 0 || s.expenses.length > 0 || s.recurring.length > 0 || s.budgets.length > 0
}

/** Compares data regardless of when it was exported, or of key order and defaults in the records. */
export function dataKey(snapshot: Snapshot): string {
  const s = normalizeSnapshot(snapshot)
  return JSON.stringify([s.accounts, s.expenses, s.categories, s.recurring, s.rules, s.budgets])
}

/** Writes `text` as the newest copy and shifts the older ones down; the oldest drops off. */
export async function writeRotated(files: BackupFiles, text: string): Promise<void> {
  for (let i = AUTO_BACKUP_FILES.length - 1; i > 0; i--) {
    const older = await files.read(AUTO_BACKUP_FILES[i - 1])
    if (older !== null) await files.write(AUTO_BACKUP_FILES[i], older)
  }
  await files.write(AUTO_BACKUP_FILES[0], text)
}

/** The newest copy that parses and holds user data; a damaged newest file falls back to an older one. */
export async function readLatest(files: BackupFiles): Promise<BackupFile | null> {
  for (const path of AUTO_BACKUP_FILES) {
    const text = await files.read(path).catch(() => null)
    if (text === null) continue
    try {
      const backup = parseBackup(text)
      if (hasUserData(backup.data)) return backup
    } catch {
      // Damaged or partial file: try the next copy.
    }
  }
  return null
}

export async function removeAll(files: BackupFiles): Promise<void> {
  for (const path of AUTO_BACKUP_FILES) await files.remove(path).catch(() => {})
}

/** Offer to restore only when this device has no user data and a backup does. */
export function restoreCandidate(current: Snapshot, backup: BackupFile | null, dismissedAt: string | null): BackupFile | null {
  if (!backup || hasUserData(current) || !hasUserData(backup.data)) return null
  if (dismissedAt !== null && dismissedAt === backup.exportedAt) return null
  return backup
}

export interface AutoBackupDeps {
  files: BackupFiles
  delayMs?: number
  now?: () => Date
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (handle: unknown) => void
}

/**
 * Debounced writer. schedule() after each change; flush() when the app goes to the background.
 * Never writes a snapshot without user data (a fresh or evicted database must not push the
 * good copies out) and never writes data identical to the last copy.
 */
export function createAutoBackup(deps: AutoBackupDeps) {
  const { files, delayMs = AUTO_BACKUP_DELAY_MS, now = () => new Date() } = deps
  const setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms))
  const clearTimer = deps.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>))
  let lastKey: string | null = null
  let pending: Snapshot | null = null
  let timer: unknown = null
  let writing: Promise<void> = Promise.resolve()

  const cancel = () => {
    if (timer !== null) clearTimer(timer)
    timer = null
    pending = null
  }

  const flush = (): Promise<void> => {
    const snapshot = pending
    cancel()
    if (!snapshot) return writing
    const key = dataKey(snapshot)
    if (key === lastKey) return writing
    // Writes run one after another so two rotations never interleave.
    writing = writing
      .then(() => writeRotated(files, serializeBackup(snapshot, now())))
      .then(() => {
        lastKey = key
      })
      .catch(() => {
        // Disk full or similar: keep the last good copies; the next change tries again.
      })
    return writing
  }

  return {
    /** The data already on disk, so an unchanged launch does not rotate the copies. */
    prime(backup: BackupFile | null) {
      lastKey = backup ? dataKey(backup.data) : null
    },
    schedule(snapshot: Snapshot) {
      if (!hasUserData(snapshot) || dataKey(snapshot) === lastKey) {
        cancel()
        return
      }
      if (timer !== null) clearTimer(timer)
      pending = snapshot
      timer = setTimer(() => void flush(), delayMs)
    },
    flush,
    /** After "Tüm verileri sil": drop pending work and the copies on disk. */
    async clear() {
      cancel()
      lastKey = null
      await writing
      await removeAll(files)
    },
  }
}

export type AutoBackup = ReturnType<typeof createAutoBackup>
