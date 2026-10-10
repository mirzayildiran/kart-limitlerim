import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { reminderPlan } from '../domain/reminders'
import type { CardAccount, CardLine } from '../domain/types'

const notif = vi.hoisted(() => ({
  requestPermissions: vi.fn(),
  getPending: vi.fn(),
  cancel: vi.fn(),
  schedule: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true },
}))

vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: notif,
}))

// The real store opens IndexedDB on import; plain signals are enough for the reminder sync.
vi.mock('../data/store', async () => {
  const { signal } = await import('@preact/signals')
  return {
    accounts: signal([]),
    ready: signal(false),
    today: signal(new Date(2026, 9, 10)),
  }
})

const line: CardLine = {
  id: 'l1',
  label: 'Ana',
  cutDay: 3,
  dueOffsetDays: 10,
  cycle: '2026-10',
  statementDebt: 1_000_000,
  minimumDue: 200_000,
  dueDate: '2026-10-13',
  payment: 'unpaid',
}

const card = (lines: CardLine[], name = 'Kart A'): CardAccount => ({
  id: 'c1',
  kind: 'card',
  name,
  limit: 5_000_000,
  available: 3_000_000,
  lines,
  updatedAt: 0,
  createdAt: 0,
})

let stored: Record<string, string>

/** Loads fresh store and reminder modules so the module-level signals and debounce timer start clean. */
async function load() {
  const store = await import('../data/store')
  const mod = await import('./reminders')
  return { store, mod }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 10, 9))

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

  for (const fn of Object.values(notif)) fn.mockReset()
  notif.requestPermissions.mockResolvedValue({ display: 'granted' })
  notif.getPending.mockResolvedValue({ notifications: [] })
  notif.cancel.mockResolvedValue(undefined)
  notif.schedule.mockResolvedValue(undefined)

  vi.resetModules()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('startReminders', () => {
  it('does not touch notifications while card data has not loaded', async () => {
    stored['kl:reminders'] = 'on'
    const { store, mod } = await load()
    store.accounts.value = [card([line])]
    expect(store.ready.value).toBe(false)

    mod.startReminders()
    await vi.advanceTimersByTimeAsync(1000)

    expect(notif.getPending).not.toHaveBeenCalled()
    expect(notif.cancel).not.toHaveBeenCalled()
    expect(notif.schedule).not.toHaveBeenCalled()
  })

  it('cancels the pending set and schedules the plan after the 400 ms debounce', async () => {
    stored['kl:reminders'] = 'on'
    notif.getPending.mockResolvedValue({ notifications: [{ id: 101 }, { id: 102 }] })
    const { store, mod } = await load()
    store.accounts.value = [card([line])]
    store.ready.value = true

    mod.startReminders()
    await vi.advanceTimersByTimeAsync(399)
    expect(notif.getPending).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    await vi.waitFor(() => expect(notif.schedule).toHaveBeenCalled())

    const plan = reminderPlan([card([line])], new Date())
    expect(plan.map((r) => r.title)).toEqual(['Kart A son ödeme 2 gün sonra', 'Kart A son ödeme bugün'])
    expect(notif.cancel).toHaveBeenCalledWith({ notifications: [{ id: 101 }, { id: 102 }] })
    expect(notif.schedule).toHaveBeenCalledWith({
      notifications: plan.map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
        schedule: { at: r.at, allowWhileIdle: true },
      })),
    })
  })
})

describe('setReminders', () => {
  it('returns false and stores nothing when iOS notification permission is denied', async () => {
    notif.requestPermissions.mockResolvedValue({ display: 'denied' })
    const { mod } = await load()

    await expect(mod.setReminders(true)).resolves.toBe(false)
    expect(stored['kl:reminders']).toBeUndefined()
    expect(mod.remindersOn.value).toBe(false)
  })
})
