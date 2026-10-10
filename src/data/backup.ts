import { cleanBudgets, type Db, type Snapshot } from './db'
import { RecordError, readAccount, readCategory, readExpense, readRecurring, readRule } from './backupSchema'

/**
 * Portable backup file. Lets users move devices; nothing is synced anywhere. The automatic
 * on-device backup and "Yedeği dışa aktar" write exactly this format (serializeBackup).
 *
 * Schema history:
 * - 1: five record lists; `budgets` was added later and is missing from early files.
 * - 2: `budgets` is always present. Records are checked field by field on import.
 */
export const BACKUP_SCHEMA = 2

export interface BackupFile {
  app: 'kart-limitlerim'
  schema: typeof BACKUP_SCHEMA
  exportedAt: string
  data: Snapshot
}

export function makeBackup(snapshot: Snapshot, now = new Date()): BackupFile {
  return { app: 'kart-limitlerim', schema: BACKUP_SCHEMA, exportedAt: now.toISOString(), data: snapshot }
}

/** The one text form of a backup, shared by the automatic copy and the manual export. */
export function serializeBackup(snapshot: Snapshot, now = new Date()): string {
  return JSON.stringify(makeBackup(snapshot, now), null, 2)
}

export class BackupError extends Error {}

/** Far above any real backup (years of data are well under 5 MB); stops a huge file freezing the app. */
export const MAX_BACKUP_CHARS = 20_000_000
/** Per list; a heavy user adds a few thousand expenses a year. */
export const MAX_RECORDS = 100_000

const LISTS = ['accounts', 'expenses', 'categories', 'recurring', 'rules'] as const
type ListKey = (typeof LISTS)[number]

const READERS: { [K in ListKey]: (v: unknown) => Snapshot[K][number] } = {
  accounts: readAccount,
  expenses: readExpense,
  categories: readCategory,
  recurring: readRecurring,
  rules: readRule,
}

/** Turkish name of one record in each list, for error messages ("3. harcama"). */
const RECORD_NAME: Record<ListKey, string> = {
  accounts: 'hesap',
  expenses: 'harcama',
  categories: 'kategori',
  recurring: 'düzenli ödeme',
  rules: 'kural',
}

type RawData = Record<string, unknown>

/**
 * Upgrades the `data` of an older file one schema step at a time. Index n holds the step from
 * schema n to n + 1. Steps only add or rename; values are checked afterwards.
 */
const MIGRATIONS: ((data: RawData) => RawData)[] = [
  (data) => data, // 0 does not exist
  // 1 → 2: files from before budgets get an empty plan.
  (data) => (data.budgets === undefined ? { ...data, budgets: [] } : data),
]

export function migrate(schema: number, data: RawData): RawData {
  let out = data
  for (let s = schema; s < BACKUP_SCHEMA; s++) out = MIGRATIONS[s](out)
  return out
}

const broken = (detail?: string) =>
  new BackupError(detail ? `Yedek dosyası bozuk: ${detail}.` : 'Yedek dosyası eksik ya da bozuk.')

/** Validate untrusted JSON text and return a backup, or throw BackupError with a user-facing message. */
export function parseBackup(text: string): BackupFile {
  if (text.length > MAX_BACKUP_CHARS) throw new BackupError('Dosya bir Kart Limitlerim yedeği için fazla büyük.')
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new BackupError('Dosya okunamadı. Kart Limitlerim yedek dosyası seçtiğinden emin ol.')
  }
  if (typeof raw !== 'object' || raw === null || (raw as { app?: unknown }).app !== 'kart-limitlerim') {
    throw new BackupError('Bu dosya bir Kart Limitlerim yedeği değil.')
  }
  const b = raw as { schema?: unknown; exportedAt?: unknown; data?: unknown }
  if (typeof b.schema !== 'number' || !Number.isInteger(b.schema) || b.schema < 1) throw broken()
  if (b.schema > BACKUP_SCHEMA) {
    throw new BackupError('Bu yedek uygulamanın daha yeni bir sürümüyle alınmış. Uygulamayı güncelleyip tekrar dene.')
  }
  if (typeof b.data !== 'object' || b.data === null || Array.isArray(b.data)) throw broken()
  const exportedAt = typeof b.exportedAt === 'string' && !Number.isNaN(Date.parse(b.exportedAt)) ? b.exportedAt : null
  if (!exportedAt) throw broken('dışa aktarma tarihi yok')

  const d = migrate(b.schema, b.data as RawData)
  const data = {} as Snapshot
  for (const key of LISTS) {
    const list = d[key]
    if (!Array.isArray(list)) throw broken()
    if (list.length > MAX_RECORDS) throw new BackupError('Dosya bir Kart Limitlerim yedeği için fazla büyük.')
    const read = READERS[key] as (v: unknown) => never
    data[key] = list.map((item, i) => {
      try {
        return read(item)
      } catch (err) {
        if (err instanceof RecordError) throw broken(`${i + 1}. ${RECORD_NAME[key]}, ${err.message} geçersiz`)
        throw err
      }
    })
  }
  if (!Array.isArray(d.budgets)) throw broken()
  data.budgets = cleanBudgets(d.budgets)
  return { app: 'kart-limitlerim', schema: BACKUP_SCHEMA, exportedAt, data }
}

/**
 * The snapshot as a backup file would hold it: known fields, fixed key order, defaults filled.
 * Lets the automatic backup tell "same data" apart from a real change. A record that fails the
 * check is kept as it is.
 */
export function normalizeSnapshot(s: Snapshot): Snapshot {
  const out = { budgets: cleanBudgets(s.budgets) } as Snapshot
  for (const key of LISTS) {
    const read = READERS[key] as (v: unknown) => never
    out[key] = s[key].map((item) => {
      try {
        return read(item)
      } catch {
        return item as never
      }
    })
  }
  return out
}

/** Replace everything on this device with the backup's contents. */
export async function restoreBackup(db: Db, backup: BackupFile): Promise<void> {
  const tx = db.transaction([...LISTS, 'meta'], 'readwrite')
  for (const s of LISTS) {
    const store = tx.objectStore(s)
    await store.clear()
    for (const item of backup.data[s]) await store.put(item as never)
  }
  // Replace only the budgets key; other meta keys are left as they are.
  await tx.objectStore('meta').put({ key: 'budgets', value: cleanBudgets(backup.data.budgets) })
  await tx.done
}
