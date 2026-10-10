import { cleanBudgets, type Db, type Snapshot } from './db'

/** Portable backup file. Lets users move devices; nothing is synced anywhere. */
export interface BackupFile {
  app: 'kart-limitlerim'
  schema: 1
  exportedAt: string
  data: Snapshot
}

export function makeBackup(snapshot: Snapshot, now = new Date()): BackupFile {
  return { app: 'kart-limitlerim', schema: 1, exportedAt: now.toISOString(), data: snapshot }
}

export class BackupError extends Error {}

const isArr = (x: unknown): x is unknown[] => Array.isArray(x)
const hasId = (x: unknown) => typeof x === 'object' && x !== null && typeof (x as { id?: unknown }).id === 'string'

/** Validate untrusted JSON text and return a backup, or throw BackupError with a user-facing message. */
/** Far above any real backup (years of data are well under 5 MB); stops a huge file freezing the app. */
export const MAX_BACKUP_CHARS = 20_000_000

export function parseBackup(text: string): BackupFile {
  if (text.length > MAX_BACKUP_CHARS) throw new BackupError('Dosya bir Kart Limitlerim yedeği için fazla büyük.')
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new BackupError('Dosya okunamadı. Kart Limitlerim yedek dosyası seçtiğinden emin ol.')
  }
  const b = raw as Partial<BackupFile>
  if (b?.app !== 'kart-limitlerim') throw new BackupError('Bu dosya bir Kart Limitlerim yedeği değil.')
  if (b.schema !== 1) throw new BackupError('Bu yedek uygulamanın daha yeni bir sürümüyle alınmış. Uygulamayı güncelleyip tekrar dene.')
  const d = b.data as Partial<Snapshot> | undefined
  const keys = ['accounts', 'expenses', 'categories', 'recurring', 'rules'] as const
  for (const k of keys) {
    const list = d?.[k]
    if (!isArr(list) || !list.every(hasId)) throw new BackupError('Yedek dosyası eksik ya da bozuk.')
  }
  // Optional: backups made before budgets existed have no key at all.
  const budgets: unknown = d?.budgets
  if (budgets !== undefined && !isArr(budgets)) throw new BackupError('Yedek dosyası eksik ya da bozuk.')
  return { ...b, data: { ...d, budgets: cleanBudgets(budgets) } } as BackupFile
}

/** Replace everything on this device with the backup's contents. */
export async function restoreBackup(db: Db, backup: BackupFile): Promise<void> {
  const stores = ['accounts', 'expenses', 'categories', 'recurring', 'rules'] as const
  const tx = db.transaction([...stores, 'meta'], 'readwrite')
  for (const s of stores) {
    const store = tx.objectStore(s)
    await store.clear()
    for (const item of backup.data[s]) await store.put(item as never)
  }
  // Replace only the budgets key; other meta keys are left as they are.
  await tx.objectStore('meta').put({ key: 'budgets', value: cleanBudgets(backup.data.budgets) })
  await tx.done
}
