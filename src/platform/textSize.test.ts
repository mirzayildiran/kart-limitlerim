import { describe, it, expect, vi } from 'vitest'

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }))

const { rootSizeFor } = await import('./textSize')

describe('rootSizeFor', () => {
  it('keeps the 16px root at the default system size', () => {
    expect(rootSizeFor(17)).toBe(16)
  })

  it('scales with larger and smaller system text', () => {
    expect(rootSizeFor(19)).toBeCloseTo(17.88, 2)
    expect(rootSizeFor(15)).toBeCloseTo(14.12, 2)
  })

  it('caps the largest accessibility sizes and the smallest setting', () => {
    expect(rootSizeFor(53)).toBe(22)
    expect(rootSizeFor(12)).toBe(14)
  })

  it('falls back to 16px when the system size cannot be read', () => {
    expect(rootSizeFor(Number.NaN)).toBe(16)
    expect(rootSizeFor(0)).toBe(16)
  })
})
