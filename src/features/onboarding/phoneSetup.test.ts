import { describe, expect, it, vi } from 'vitest'

vi.mock('../../data/store', () => ({}))
vi.mock('../../platform/files', () => ({ isNativeApp: false }))
vi.mock('../../ui/nav', () => ({}))

const { shouldOfferPhoneSetup } = await import('./phoneSetup')

const base = { native: true, seen: false, hadCards: false, cardCount: 1, sheetOpen: false }

describe('shouldOfferPhoneSetup', () => {
  it('offers once the first card exists on a first run, after its sheet closed', () => {
    expect(shouldOfferPhoneSetup(base)).toBe(true)
  })

  it('waits while the add-card sheet is still open', () => {
    expect(shouldOfferPhoneSetup({ ...base, sheetOpen: true })).toBe(false)
  })

  it('never in the browser, never twice, never before a card', () => {
    expect(shouldOfferPhoneSetup({ ...base, native: false })).toBe(false)
    expect(shouldOfferPhoneSetup({ ...base, seen: true })).toBe(false)
    expect(shouldOfferPhoneSetup({ ...base, cardCount: 0 })).toBe(false)
  })

  it('not for someone who already had cards when the app opened', () => {
    expect(shouldOfferPhoneSetup({ ...base, hadCards: true })).toBe(false)
  })
})
