import { effect, signal } from '@preact/signals'
import { isNativeApp, libraryFiles } from '../platform/files'
import { createAutoBackup, readLatest, restoreCandidate, type AutoBackup } from './autoBackup'
import type { BackupFile } from './backup'
import type { Snapshot } from './db'
import { accounts, budgets, categories, expenses, importBackupText, loadError, ready, recurring, rules } from './store'

/** Wires the automatic backup (src/data/autoBackup.ts) to the store. iOS app only. */

const DISMISS_KEY = 'kl:autobackup-dismissed'

/** A backup found while this device's database is empty; the home screen offers to restore it. */
export const restoreOffer = signal<BackupFile | null>(null)

let auto: AutoBackup | null = null

const snapshot = (): Snapshot => ({
  accounts: accounts.value,
  expenses: expenses.value,
  categories: categories.value,
  recurring: recurring.value,
  rules: rules.value,
  budgets: budgets.value,
})

function loadDismissed(): string | null {
  try {
    return localStorage.getItem(DISMISS_KEY)
  } catch {
    return null
  }
}

/** Call once at startup. Does nothing in the browser, where the PWA asks for persistent storage instead. */
export function startAutoBackup(): void {
  if (!isNativeApp) return
  const files = libraryFiles()
  const backup = (auto = createAutoBackup({ files }))
  let started = false
  effect(() => {
    if (!ready.value || started) return
    started = true
    if (loadError.value) return // The database did not open; do not touch the copies.
    void readLatest(files).then((latest) => {
      backup.prime(latest)
      restoreOffer.value = restoreCandidate(snapshot(), latest, loadDismissed())
      // Reads every store signal, so any change schedules a write.
      effect(() => backup.schedule(snapshot()))
    })
  })
  // Leaving the app: write now rather than in five seconds, in case iOS ends the process.
  import('@capacitor/app')
    .then(({ App }) => App.addListener('pause', () => void backup.flush()))
    .catch(() => {})
}

export async function acceptRestore(): Promise<void> {
  const offer = restoreOffer.value
  if (!offer) return
  await importBackupText(JSON.stringify(offer))
  restoreOffer.value = null
}

/** "Şimdi değil": do not ask again for this copy. It stays on disk until newer data replaces it. */
export function dismissRestore(): void {
  const offer = restoreOffer.value
  restoreOffer.value = null
  if (!offer) return
  try {
    localStorage.setItem(DISMISS_KEY, offer.exportedAt)
  } catch {
    // Not remembered; the offer may come back on the next launch.
  }
}

/** After "Tüm verileri sil": the copies go too, so erased data is never offered back. */
export async function clearAutoBackups(): Promise<void> {
  restoreOffer.value = null
  await auto?.clear()
}
