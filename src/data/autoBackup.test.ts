import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Account } from '../domain/types'
import {
  AUTO_BACKUP_FILES,
  createAutoBackup,
  hasUserData,
  readLatest,
  restoreCandidate,
  writeRotated,
  type BackupFiles,
} from './autoBackup'
import { makeBackup, parseBackup } from './backup'
import type { Snapshot } from './db'

const [NEWEST, MIDDLE, OLDEST] = AUTO_BACKUP_FILES

function memoryFiles() {
  const disk = new Map<string, string>()
  const files: BackupFiles = {
    read: async (p) => disk.get(p) ?? null,
    write: async (p, t) => void disk.set(p, t),
    remove: async (p) => void disk.delete(p),
  }
  return { disk, files }
}

const empty = (): Snapshot => ({ accounts: [], expenses: [], categories: [], recurring: [], rules: [], budgets: [] })
const withAccount = (name: string): Snapshot => ({
  ...empty(),
  accounts: [{ id: `acc-${name}`, kind: 'bank', name, balance: 0, updatedAt: 0, createdAt: 0 } as unknown as Account],
})
const nameIn = (text: string | undefined) => (text ? parseBackup(text).data.accounts[0]?.name : undefined)

describe('hasUserData', () => {
  it('ignores default categories and rules', () => {
    expect(hasUserData({ ...empty(), categories: [{ id: 'c' } as never], rules: [{ id: 'r' } as never] })).toBe(false)
    expect(hasUserData(withAccount('A'))).toBe(true)
  })
})

describe('writeRotated', () => {
  it('keeps the newest three copies, newest first', async () => {
    const { disk, files } = memoryFiles()
    for (const n of ['1', '2', '3', '4']) await writeRotated(files, n)
    expect([disk.get(NEWEST), disk.get(MIDDLE), disk.get(OLDEST)]).toEqual(['4', '3', '2'])
    expect(disk.size).toBe(3)
  })

  it('fills the slots one by one on the first writes', async () => {
    const { disk, files } = memoryFiles()
    await writeRotated(files, 'a')
    expect([...disk.keys()]).toEqual([NEWEST])
  })
})

describe('readLatest', () => {
  it('returns the newest copy with user data', async () => {
    const { disk, files } = memoryFiles()
    disk.set(NEWEST, JSON.stringify(makeBackup(withAccount('Yeni'))))
    disk.set(MIDDLE, JSON.stringify(makeBackup(withAccount('Eski'))))
    expect((await readLatest(files))?.data.accounts[0].name).toBe('Yeni')
  })

  it('falls back to an older copy when the newest is damaged or empty', async () => {
    const { disk, files } = memoryFiles()
    disk.set(NEWEST, '{"app":"kart-limitlerim","sch')
    disk.set(MIDDLE, JSON.stringify(makeBackup(empty())))
    disk.set(OLDEST, JSON.stringify(makeBackup(withAccount('Eski'))))
    expect((await readLatest(files))?.data.accounts[0].name).toBe('Eski')
  })

  it('returns null when there is no copy', async () => {
    expect(await readLatest(memoryFiles().files)).toBeNull()
  })
})

describe('restoreCandidate', () => {
  const backup = makeBackup(withAccount('A'), new Date('2026-10-10T10:00:00Z'))

  it('offers the backup when this device has no user data', () => {
    expect(restoreCandidate(empty(), backup, null)).toBe(backup)
  })

  it('does not offer it when the device already has data', () => {
    expect(restoreCandidate(withAccount('B'), backup, null)).toBeNull()
  })

  it('does not offer a backup the user dismissed, but offers a newer one', () => {
    expect(restoreCandidate(empty(), backup, backup.exportedAt)).toBeNull()
    expect(restoreCandidate(empty(), backup, '2026-10-01T00:00:00.000Z')).toBe(backup)
  })

  it('does not offer a backup without user data, or no backup', () => {
    expect(restoreCandidate(empty(), makeBackup(empty()), null)).toBeNull()
    expect(restoreCandidate(empty(), null, null)).toBeNull()
  })
})

describe('createAutoBackup', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('writes once, 5 s after the last of several quick changes', async () => {
    const { disk, files } = memoryFiles()
    const auto = createAutoBackup({ files })
    auto.schedule(withAccount('A'))
    await vi.advanceTimersByTimeAsync(3_000)
    auto.schedule(withAccount('B'))
    await vi.advanceTimersByTimeAsync(4_999)
    expect(disk.size).toBe(0)
    await vi.advanceTimersByTimeAsync(1)
    expect(nameIn(disk.get(NEWEST))).toBe('B')
    expect(disk.has(MIDDLE)).toBe(false)
  })

  it('never writes a snapshot without user data, so an emptied database keeps the good copies', async () => {
    const { disk, files } = memoryFiles()
    const auto = createAutoBackup({ files })
    auto.schedule(withAccount('A'))
    await vi.advanceTimersByTimeAsync(5_000)
    auto.schedule(empty())
    await vi.advanceTimersByTimeAsync(10_000)
    expect(nameIn(disk.get(NEWEST))).toBe('A')
    expect(disk.size).toBe(1)
  })

  it('cancels a pending write when the data becomes empty before it fires', async () => {
    const { disk, files } = memoryFiles()
    const auto = createAutoBackup({ files })
    auto.schedule(withAccount('A'))
    auto.schedule(empty())
    await vi.advanceTimersByTimeAsync(10_000)
    expect(disk.size).toBe(0)
  })

  it('does not rotate when the data equals the copy on disk', async () => {
    const { disk, files } = memoryFiles()
    const auto = createAutoBackup({ files })
    const onDisk = makeBackup(withAccount('A'), new Date('2026-01-01'))
    disk.set(NEWEST, JSON.stringify(onDisk))
    auto.prime(onDisk)
    auto.schedule(withAccount('A'))
    await vi.advanceTimersByTimeAsync(10_000)
    expect(disk.size).toBe(1)
    expect(parseBackup(disk.get(NEWEST)!).exportedAt).toBe(onDisk.exportedAt)
  })

  it('treats the copy read back from disk as unchanged when the live records hold fewer keys', async () => {
    const { disk, files } = memoryFiles()
    const auto = createAutoBackup({ files })
    const card = { kind: 'card', id: 'k', name: 'Kart', limit: 100, available: 50, lines: [{ id: 'l', cutDay: 5, cycle: null }] }
    const live = (): Snapshot => ({ ...empty(), accounts: [card as unknown as Account] })
    disk.set(NEWEST, JSON.stringify(makeBackup(live())))
    const onDisk = parseBackup(disk.get(NEWEST)!)
    expect(onDisk.data.accounts[0]).not.toEqual(card) // defaults filled on read
    auto.prime(onDisk)
    auto.schedule(live())
    await vi.advanceTimersByTimeAsync(10_000)
    expect(disk.size).toBe(1)
  })

  it('flush() writes the pending change at once', async () => {
    const { disk, files } = memoryFiles()
    const auto = createAutoBackup({ files })
    auto.schedule(withAccount('A'))
    await auto.flush()
    expect(nameIn(disk.get(NEWEST))).toBe('A')
  })

  it('rotates on each real change and keeps three', async () => {
    const { disk, files } = memoryFiles()
    const auto = createAutoBackup({ files })
    for (const n of ['A', 'B', 'C', 'D']) {
      auto.schedule(withAccount(n))
      await auto.flush()
    }
    expect([nameIn(disk.get(NEWEST)), nameIn(disk.get(MIDDLE)), nameIn(disk.get(OLDEST))]).toEqual(['D', 'C', 'B'])
  })

  it('clear() drops the pending write and every copy', async () => {
    const { disk, files } = memoryFiles()
    const auto = createAutoBackup({ files })
    auto.schedule(withAccount('A'))
    await auto.flush()
    auto.schedule(withAccount('B'))
    await auto.clear()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(disk.size).toBe(0)
  })

  it('keeps the old copies when a write fails, and tries again on the next change', async () => {
    const { disk, files } = memoryFiles()
    const auto = createAutoBackup({ files })
    auto.schedule(withAccount('A'))
    await auto.flush()
    const failing: BackupFiles = { ...files, write: async () => Promise.reject(new Error('disk full')) }
    const broken = createAutoBackup({ files: failing })
    broken.schedule(withAccount('B'))
    await expect(broken.flush()).resolves.toBeUndefined()
    expect(nameIn(disk.get(NEWEST))).toBe('A')
  })
})
