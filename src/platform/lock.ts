import { signal } from '@preact/signals'
import { isNativeApp } from './files'

/**
 * Face ID lock for the iOS app. When on, the app locks each time it goes to the
 * background and asks for Face ID (or the device passcode) on return. While the
 * app is inactive (app switcher, Control Centre) the content is covered so the
 * switcher snapshot shows no balances.
 */

const STORAGE_KEY = 'kl:lock'

function loadPref(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'on'
  } catch {
    return false
  }
}

export const lockOn = signal(isNativeApp && loadPref())
/** Content hidden behind the lock screen until Face ID succeeds. */
export const locked = signal(lockOn.value)
/** App inactive: cover the content without asking for Face ID. */
export const shielded = signal(false)

/** The Face ID sheet itself makes the app inactive; ignore that while it is up. */
let verifying = false

/** Outcome of an unlock attempt: opened, dismissed by the user or the system, or not recognised. */
export type UnlockResult = 'ok' | 'cancelled' | 'failed'

/** Last unlock attempt while locked; null until one finishes. Cleared each time the app locks. */
export const unlockResult = signal<UnlockResult | null>(null)

// Resolve to the module, never to the plugin itself: Capacitor plugins are proxies that
// treat any property, including `then`, as a native method, so awaiting one rejects.
const load = () => import('@capgo/capacitor-native-biometric')

// Plugin error codes (BiometricAuthError) for a prompt closed without an answer:
// APP_CANCEL, SYSTEM_CANCEL, USER_CANCEL. Capacitor passes them as strings on iOS.
const CANCEL_CODES = new Set(['11', '15', '16'])

/** Maps a verifyIdentity rejection to cancelled (prompt closed) or failed (not recognised, locked out, other). */
export function verifyErrorResult(err: unknown): Exclude<UnlockResult, 'ok'> {
  const code = (err as { code?: unknown } | null)?.code
  return code != null && CANCEL_CODES.has(String(code)) ? 'cancelled' : 'failed'
}

async function verify(reason: string): Promise<UnlockResult> {
  // A prompt is already up; this call did not get an answer of its own.
  if (verifying) return 'cancelled'
  verifying = true
  try {
    const { NativeBiometric: biometric } = await load()
    await biometric.verifyIdentity({ reason, useFallback: true })
    return 'ok'
  } catch (err) {
    return verifyErrorResult(err)
  } finally {
    verifying = false
  }
}

export async function unlock(): Promise<UnlockResult> {
  // With no passcode or Face ID left on the phone there is nothing to verify against;
  // stay usable rather than locking the user out of their own data.
  const { isAvailable } = await (await load()).NativeBiometric.isAvailable({ useFallback: true }).catch(() => ({ isAvailable: false }))
  const result = isAvailable ? await verify('Bakiyelerini görmek için kilidi aç') : 'ok'
  if (result === 'ok') locked.value = false
  unlockResult.value = result
  return result
}

/** Turning the lock on asks for Face ID once, so a user cannot lock themselves out unknowingly. */
export async function setLock(on: boolean): Promise<'ok' | 'unavailable' | 'cancelled'> {
  if (on) {
    const { NativeBiometric: biometric } = await load()
    const { isAvailable } = await biometric.isAvailable({ useFallback: true })
    if (!isAvailable) return 'unavailable'
    if ((await verify('Uygulama kilidini açmak için doğrula')) !== 'ok') return 'cancelled'
  }
  try {
    localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off')
  } catch {
    // Not persisted, but the choice still applies for this session.
  }
  lockOn.value = on
  return 'ok'
}

/** Wires the lock to the app lifecycle. Call once at startup. */
export function startLock(): void {
  if (!isNativeApp) return
  import('@capacitor/app')
    .then(({ App }) => {
      App.addListener('appStateChange', ({ isActive }) => {
        if (verifying) return
        shielded.value = !isActive && lockOn.value
      })
      App.addListener('pause', () => {
        if (!lockOn.value) return
        locked.value = true
        unlockResult.value = null
      })
      App.addListener('resume', () => {
        if (locked.value) unlock()
      })
    })
    .catch(() => {})
  if (locked.value) unlock()
}
