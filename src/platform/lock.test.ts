import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const biometric = vi.hoisted(() => ({
  isAvailable: vi.fn(),
  verifyIdentity: vi.fn(),
}))

const app = vi.hoisted(() => ({
  handlers: {} as Record<string, (arg?: unknown) => void>,
  addListener: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true },
}))

vi.mock('@capgo/capacitor-native-biometric', () => ({
  NativeBiometric: biometric,
}))

vi.mock('@capacitor/app', () => ({
  App: { addListener: app.addListener },
}))

let stored: Record<string, string>

/** Calls a lifecycle listener registered by startLock(). */
function fire(event: string, arg?: unknown) {
  const handler = app.handlers[event]
  if (!handler) throw new Error(`no ${event} listener registered`)
  handler(arg)
}

/** Loads a fresh lock module so the module-level signals start from the stored preference. */
async function load(opts: { lockOn?: boolean } = {}) {
  if (opts.lockOn) stored['kl:lock'] = 'on'
  return import('./lock')
}

/** Starts the lock with the preference on and waits for the launch-time unlock to finish. */
async function startedWithLock() {
  const lock = await load({ lockOn: true })
  lock.startLock()
  await vi.waitFor(() => expect(app.handlers.resume).toBeDefined())
  await vi.waitFor(() => expect(lock.locked.value).toBe(false))
  biometric.verifyIdentity.mockClear()
  return lock
}

beforeEach(() => {
  stored = {}
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => stored[k] ?? null,
    setItem: (k: string, v: string) => {
      stored[k] = v
    },
    removeItem: (k: string) => {
      delete stored[k]
    },
  })

  biometric.isAvailable.mockReset()
  biometric.verifyIdentity.mockReset()
  biometric.isAvailable.mockResolvedValue({ isAvailable: true })
  biometric.verifyIdentity.mockResolvedValue(undefined)

  app.addListener.mockReset()
  app.addListener.mockImplementation((event: string, cb: (arg?: unknown) => void) => {
    app.handlers[event] = cb
  })
  for (const k of Object.keys(app.handlers)) delete app.handlers[k]

  vi.resetModules()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('setLock', () => {
  it('returns unavailable and leaves the lock off when the device has no Face ID or passcode', async () => {
    biometric.isAvailable.mockResolvedValue({ isAvailable: false })
    const { setLock, lockOn } = await load()

    await expect(setLock(true)).resolves.toBe('unavailable')
    expect(lockOn.value).toBe(false)
    expect(biometric.verifyIdentity).not.toHaveBeenCalled()
    expect(stored['kl:lock']).toBeUndefined()
  })

  it('returns cancelled and leaves the lock off when verification is rejected', async () => {
    biometric.verifyIdentity.mockRejectedValue(new Error('User cancel'))
    const { setLock, lockOn } = await load()

    await expect(setLock(true)).resolves.toBe('cancelled')
    expect(lockOn.value).toBe(false)
    expect(stored['kl:lock']).toBeUndefined()
  })

  it('turns the lock on and persists it once verification succeeds', async () => {
    const { setLock, lockOn } = await load()

    await expect(setLock(true)).resolves.toBe('ok')
    expect(lockOn.value).toBe(true)
    expect(stored['kl:lock']).toBe('on')
  })
})

describe('startLock lifecycle', () => {
  it('pause locks the app and resume asks for Face ID again', async () => {
    const lock = await startedWithLock()

    fire('pause')
    expect(lock.locked.value).toBe(true)

    fire('resume')
    await vi.waitFor(() => expect(lock.locked.value).toBe(false))
    expect(biometric.verifyIdentity).toHaveBeenCalledTimes(1)
  })

  it('shields content when inactive only while the lock is on, and clears it on return', async () => {
    const lock = await startedWithLock()

    fire('appStateChange', { isActive: false })
    expect(lock.shielded.value).toBe(true)

    fire('appStateChange', { isActive: true })
    expect(lock.shielded.value).toBe(false)
  })

  it('never shields content when the lock is off', async () => {
    const lock = await load()
    lock.startLock()
    await vi.waitFor(() => expect(app.handlers.appStateChange).toBeDefined())

    fire('appStateChange', { isActive: false })
    expect(lock.shielded.value).toBe(false)
  })

  it('does not shield while a Face ID prompt is up, since the prompt itself makes the app inactive', async () => {
    const lock = await startedWithLock()
    let finishPrompt: () => void = () => {}
    biometric.verifyIdentity.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishPrompt = resolve
        }),
    )

    const change = lock.setLock(true)
    await vi.waitFor(() => expect(biometric.verifyIdentity).toHaveBeenCalledTimes(1))

    fire('appStateChange', { isActive: false })
    expect(lock.shielded.value).toBe(false)

    finishPrompt()
    await expect(change).resolves.toBe('ok')

    fire('appStateChange', { isActive: false })
    expect(lock.shielded.value).toBe(true)
  })
})

describe('unlock', () => {
  it('unlocks without Face ID when the device has no biometrics or passcode', async () => {
    biometric.isAvailable.mockResolvedValue({ isAvailable: false })
    const lock = await load({ lockOn: true })
    expect(lock.locked.value).toBe(true)

    await lock.unlock()

    expect(lock.locked.value).toBe(false)
    expect(biometric.verifyIdentity).not.toHaveBeenCalled()
  })
})
