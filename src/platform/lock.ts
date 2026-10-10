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

const plugin = () => import('@capgo/capacitor-native-biometric').then((m) => m.NativeBiometric)

async function verify(reason: string): Promise<boolean> {
  if (verifying) return false
  verifying = true
  try {
    const biometric = await plugin()
    await biometric.verifyIdentity({ reason, useFallback: true })
    return true
  } catch {
    return false
  } finally {
    verifying = false
  }
}

export async function unlock(): Promise<void> {
  // With no passcode or Face ID left on the phone there is nothing to verify against;
  // stay usable rather than locking the user out of their own data.
  const { isAvailable } = await (await plugin()).isAvailable({ useFallback: true }).catch(() => ({ isAvailable: false }))
  if (!isAvailable || (await verify('Bakiyelerini görmek için kilidi aç'))) locked.value = false
}

/** Turning the lock on asks for Face ID once, so a user cannot lock themselves out unknowingly. */
export async function setLock(on: boolean): Promise<'ok' | 'unavailable' | 'cancelled'> {
  if (on) {
    const biometric = await plugin()
    const { isAvailable } = await biometric.isAvailable({ useFallback: true })
    if (!isAvailable) return 'unavailable'
    if (!(await verify('Uygulama kilidini açmak için doğrula'))) return 'cancelled'
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
        if (lockOn.value) locked.value = true
      })
      App.addListener('resume', () => {
        if (locked.value) unlock()
      })
    })
    .catch(() => {})
  if (locked.value) unlock()
}
