import { describe, it, expect } from 'vitest'
import {
  addDays,
  cycleKeyOf,
  dayInMonth,
  daysBetween,
  formatLong,
  formatMonth,
  formatShort,
  fromIso,
  monthStart,
  nextBusinessDay,
  shiftMonth,
  startOfDay,
  toIso,
} from './dates'

describe('dates', () => {
  describe('startOfDay', () => {
    it('returns local midnight', () => {
      const d = new Date(2026, 9, 15, 14, 30, 45)
      const result = startOfDay(d)
      expect(result.getHours()).toBe(0)
      expect(result.getMinutes()).toBe(0)
      expect(result.getSeconds()).toBe(0)
      expect(result.getDate()).toBe(15)
    })
  })

  describe('toIso / fromIso', () => {
    it('converts to and from ISO date strings', () => {
      const d = new Date(2026, 9, 15) // October 15, 2026
      const iso = toIso(d)
      expect(iso).toBe('2026-10-15')
      expect(fromIso(iso)).toEqual(d)
    })

    it('pads month and day with zeros', () => {
      expect(toIso(new Date(2026, 0, 5))).toBe('2026-01-05')
      expect(toIso(new Date(2026, 8, 9))).toBe('2026-09-09')
    })
  })

  describe('addDays', () => {
    it('adds days to a date', () => {
      const d = new Date(2026, 9, 15)
      const result = addDays(d, 5)
      expect(result).toEqual(new Date(2026, 9, 20))
    })

    it('handles month boundaries', () => {
      const d = new Date(2026, 9, 28)
      const result = addDays(d, 5)
      expect(result).toEqual(new Date(2026, 10, 2))
    })

    it('handles year boundaries', () => {
      const d = new Date(2026, 11, 28)
      const result = addDays(d, 10)
      expect(result).toEqual(new Date(2027, 0, 7))
    })

    it('handles negative days', () => {
      const d = new Date(2026, 9, 15)
      const result = addDays(d, -5)
      expect(result).toEqual(new Date(2026, 9, 10))
    })
  })

  describe('daysBetween', () => {
    it('calculates days between two dates', () => {
      const a = new Date(2026, 9, 20)
      const b = new Date(2026, 9, 15)
      expect(daysBetween(a, b)).toBe(5)
      expect(daysBetween(b, a)).toBe(-5)
    })

    it('returns 0 for the same day', () => {
      const d = new Date(2026, 9, 15)
      expect(daysBetween(d, d)).toBe(0)
    })

    it('is DST-safe (uses UTC for calculation)', () => {
      // Turkey doesn't observe DST, but we test with plain dates anyway
      const a = new Date(2026, 2, 29) // March 29
      const b = new Date(2026, 2, 28) // March 28
      expect(daysBetween(a, b)).toBe(1)
    })

    it('handles month and year boundaries', () => {
      const a = new Date(2026, 10, 5)
      const b = new Date(2026, 9, 5)
      expect(daysBetween(a, b)).toBe(31) // October has 31 days
    })
  })

  describe('dayInMonth', () => {
    it('returns the day of month when it exists', () => {
      const d = dayInMonth(2026, 9, 15) // October 15
      expect(d).toEqual(new Date(2026, 9, 15))
    })

    it('clamps day 31 to November (30 days)', () => {
      const d = dayInMonth(2026, 10, 31) // November 31 → 30
      expect(d).toEqual(new Date(2026, 10, 30))
    })

    it('clamps day 31 to February (2026 is not a leap year, 28 days)', () => {
      const d = dayInMonth(2026, 1, 31) // February 31 → 28
      expect(d).toEqual(new Date(2026, 1, 28))
    })

    it('allows February 29 in leap year (2028)', () => {
      const d = dayInMonth(2028, 1, 29) // 2028 is a leap year
      expect(d).toEqual(new Date(2028, 1, 29))
    })

    it('clamps day 31 to April (30 days)', () => {
      const d = dayInMonth(2026, 3, 31) // April 31 → 30
      expect(d).toEqual(new Date(2026, 3, 30))
    })
  })

  describe('cycleKeyOf', () => {
    it('extracts cycle key from date', () => {
      expect(cycleKeyOf(new Date(2026, 9, 15))).toBe('2026-10')
      expect(cycleKeyOf(new Date(2026, 0, 1))).toBe('2026-01')
    })
  })

  describe('monthStart', () => {
    it('returns the first day of the month', () => {
      const d = monthStart('2026-10')
      expect(d).toEqual(new Date(2026, 9, 1))
    })
  })

  describe('shiftMonth', () => {
    it('shifts cycle key forward', () => {
      expect(shiftMonth('2026-10', 1)).toBe('2026-11')
      expect(shiftMonth('2026-10', 3)).toBe('2027-01')
    })

    it('shifts cycle key backward', () => {
      expect(shiftMonth('2026-10', -1)).toBe('2026-09')
      expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    })

    it('handles year boundaries', () => {
      expect(shiftMonth('2026-12', 1)).toBe('2027-01')
      expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    })
  })

  describe('nextBusinessDay', () => {
    it('returns same day for weekday', () => {
      const monday = new Date(2026, 9, 19) // Monday
      expect(nextBusinessDay(monday)).toEqual(monday)
    })

    it('returns Monday for Saturday', () => {
      const saturday = new Date(2026, 9, 17) // Saturday, Oct 17
      const result = nextBusinessDay(saturday)
      expect(result).toEqual(new Date(2026, 9, 19)) // Monday, Oct 19
    })

    it('returns Monday for Sunday', () => {
      const sunday = new Date(2026, 9, 18) // Sunday, Oct 18
      const result = nextBusinessDay(sunday)
      expect(result).toEqual(new Date(2026, 9, 19)) // Monday, Oct 19
    })

    it('returns same day for Tuesday', () => {
      const tuesday = new Date(2026, 9, 20) // Tuesday
      expect(nextBusinessDay(tuesday)).toEqual(tuesday)
    })

    it('handles boundary correctly for Saturday to Monday', () => {
      // Verify exact day-of-week values
      const saturday = new Date(2026, 9, 17)
      expect(saturday.getDay()).toBe(6) // Confirm Saturday
      const result = nextBusinessDay(saturday)
      expect(result.getDay()).toBe(1) // Confirm Monday
    })
  })

  describe('formatShort', () => {
    it('formats date as "15 Eki" (short month)', () => {
      const d = new Date(2026, 9, 15)
      const result = formatShort(d)
      expect(result).toMatch(/15.*[Ee]k[ik]/)
    })
  })

  describe('formatLong', () => {
    it('formats date as "15 Ekim" (long month)', () => {
      const d = new Date(2026, 9, 15)
      const result = formatLong(d)
      expect(result).toMatch(/15.*[Ee]kim/)
    })
  })

  describe('formatMonth', () => {
    it('formats cycle key as "Ekim 2026"', () => {
      const result = formatMonth('2026-10')
      expect(result).toMatch(/[Ee]kim.*2026/)
    })
  })
})
