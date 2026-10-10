import { effect, signal } from '@preact/signals'
import { accounts, ready, today } from '../data/store'
import { reminderPlan, type Reminder } from '../domain/reminders'
import { statementLink, handleDeepLink } from './deeplinks'
import { isNativeApp } from './files'

/**
 * Due-date reminders as iOS local notifications. Off until the user turns them on
 * in Settings (that is when iOS asks for permission). The app is the only thing that
 * schedules notifications, so every sync replaces the whole pending set.
 */

const STORAGE_KEY = 'kl:reminders'

function loadPref(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'on'
  } catch {
    return false
  }
}

export const remindersOn = signal(isNativeApp && loadPref())

// Resolve to the module, never to the plugin itself: Capacitor plugins are proxies that
// treat any property, including `then`, as a native method, so awaiting one rejects.
const load = () => import('@capacitor/local-notifications')

/** Turns reminders on or off. Resolves false when iOS permission is denied. */
export async function setReminders(on: boolean): Promise<boolean> {
  if (on) {
    const { LocalNotifications: notifications } = await load()
    const { display } = await notifications.requestPermissions()
    if (display !== 'granted') return false
  }
  try {
    localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off')
  } catch {
    // Not persisted, but the choice still applies for this session.
  }
  remindersOn.value = on
  return true
}

async function sync(plan: Reminder[]): Promise<void> {
  const { LocalNotifications: notifications } = await load()
  const { notifications: pending } = await notifications.getPending()
  if (pending.length > 0) await notifications.cancel({ notifications: pending.map((n) => ({ id: n.id })) })
  if (plan.length === 0) return
  await notifications.schedule({
    notifications: plan.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      schedule: { at: r.at, allowWhileIdle: true },
      extra: { url: statementLink(r.accountId, r.lineIndex) },
    })),
  })
}

let timer: ReturnType<typeof setTimeout> | undefined

/** Keeps scheduled reminders in step with card data. Call once at startup. */
export function startReminders(): void {
  if (!isNativeApp) return
  // Tapping a reminder opens that card's statement (after Face ID), where it can be marked paid.
  // No "Ödendi" action button: minimum or full is the user's call, and an action from the lock
  // screen would change data without passing the Face ID lock.
  load()
    .then(({ LocalNotifications }) =>
      LocalNotifications.addListener('localNotificationActionPerformed', ({ notification }) =>
        handleDeepLink((notification.extra as { url?: string } | undefined)?.url),
      ),
    )
    .catch(() => {})
  effect(() => {
    // Until data has loaded, accounts look empty and a sync would cancel every reminder.
    if (!ready.value) return
    const on = remindersOn.value
    // Reading today makes a new day reschedule, like an edit to accounts does.
    void today.value
    const plan = on ? reminderPlan(accounts.value, new Date()) : []
    clearTimeout(timer)
    // Debounced: a statement edit writes several fields in a row.
    timer = setTimeout(() => sync(plan).catch(() => {}), 400)
  })
}
