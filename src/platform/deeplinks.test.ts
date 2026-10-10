import { describe, it, expect, vi } from 'vitest'

// The module wires itself to the store and the lock; only the pure parser is under test here.
vi.mock('../data/store', () => ({ ready: { value: true } }))
vi.mock('./lock', () => ({ locked: { value: false } }))
vi.mock('../ui/nav', () => ({ go: vi.fn(), openSheet: vi.fn() }))

const { parseDeepLink } = await import('./deeplinks')

describe('parseDeepLink', () => {
  it('maps the quick actions', () => {
    expect(parseDeepLink('kartlimitlerim://harcama-ekle')).toEqual({ sheet: 'expense' })
    expect(parseDeepLink('kartlimitlerim://takvim')).toEqual({ route: 'calendar' })
  })

  it('accepts a trailing slash, query and any case', () => {
    expect(parseDeepLink('kartlimitlerim://takvim/')).toEqual({ route: 'calendar' })
    expect(parseDeepLink('KartLimitlerim://Takvim?kaynak=widget')).toEqual({ route: 'calendar' })
  })

  it('ignores other schemes, unknown paths and nested paths', () => {
    expect(parseDeepLink('https://kartlimitlerim/takvim')).toBeNull()
    expect(parseDeepLink('kartlimitlerim://bilinmeyen')).toBeNull()
    expect(parseDeepLink('kartlimitlerim://takvim/2026')).toBeNull()
    expect(parseDeepLink('kartlimitlerim://')).toBeNull()
  })
})
