import { describe, it, expect } from 'vitest'
import { DEFAULT_CATEGORIES, displayHue, nextHue } from './categories'
import type { Category } from './types'

const cat = (id: string, hue: number): Category => ({ id, name: id, hue, builtin: false, order: 0 })

describe('displayHue', () => {
  it('keeps hues outside the violet band', () => {
    expect(displayHue(24)).toBe(24)
    expect(displayHue(140)).toBe(140)
    expect(displayHue(249)).toBe(249)
    expect(displayHue(300)).toBe(300)
    expect(displayHue(320)).toBe(320)
  })

  it('shifts 250–274 to 232', () => {
    expect(displayHue(250)).toBe(232)
    expect(displayHue(265)).toBe(232)
    expect(displayHue(274)).toBe(232)
  })

  it('shifts 275–299 to 312', () => {
    expect(displayHue(275)).toBe(312)
    expect(displayHue(290)).toBe(312)
    expect(displayHue(299)).toBe(312)
  })

  it('normalizes hues outside 0–359 first', () => {
    expect(displayHue(360 + 265)).toBe(232)
    expect(displayHue(-95)).toBe(232) // -95 → 265 → 232
    expect(displayHue(-100)).toBe(232) // -100 → 260 → 232
    expect(displayHue(720 + 24)).toBe(24)
  })
})

describe('nextHue', () => {
  it('starts at 24 when there are no categories', () => {
    expect(nextHue([])).toBe(24)
  })

  it('never returns a hue in the violet band', () => {
    // Defaults leave a large gap around 230–320; the midpoint must not land in 250–299.
    const hue = nextHue(DEFAULT_CATEGORIES)
    expect(hue < 250 || hue >= 300).toBe(true)
  })

  it('moves a midpoint inside the band to the nearer edge', () => {
    // Single hue 100: the only gap is 360 wide, midpoint 280 is inside the band; nearer edge is 300.
    expect(nextHue([cat('a', 100)])).toBe(300)
  })

  it('never returns a hue in the violet band for varied sets', () => {
    const sets = [
      [cat('a', 0)],
      [cat('a', 200), cat('b', 340)],
      [cat('a', 100), cat('b', 230)],
      [cat('a', 0), cat('b', 180)],
    ]
    for (const set of sets) {
      const hue = nextHue(set)
      expect(hue < 250 || hue >= 300).toBe(true)
      expect(hue >= 0 && hue < 360).toBe(true)
    }
  })
})
