import { describe, it, expect } from 'vitest'
import { formatInput, formatTL, formatTLExact, parseTL, toLira, toKurus } from './money'

describe('money', () => {
  describe('toKurus', () => {
    it('converts lira to integer kuruş', () => {
      expect(toKurus(1.23)).toBe(123)
      expect(toKurus(100)).toBe(10000)
      expect(toKurus(0.01)).toBe(1)
    })

    it('rounds to nearest kuruş', () => {
      expect(toKurus(1.234)).toBe(123)
      expect(toKurus(1.235)).toBe(124)
    })
  })

  describe('toLira', () => {
    it('converts kuruş to lira', () => {
      expect(toLira(123)).toBe(1.23)
      expect(toLira(10000)).toBe(100)
      expect(toLira(1)).toBe(0.01)
    })
  })

  describe('parseTL', () => {
    it('parses Turkish thousands-separated whole numbers', () => {
      expect(parseTL('1.234,56')).toBe(123456)
      expect(parseTL('1234,56')).toBe(123456)
      expect(parseTL('1234.56')).toBe(123456)
    })

    it('parses amounts without decimal part', () => {
      expect(parseTL('1.234')).toBe(123400)
      expect(parseTL('1234')).toBe(123400)
    })

    it('parses large numbers with multiple group separators', () => {
      expect(parseTL('12.345.678')).toBe(1234567800)
    })

    it('ignores currency symbols and spaces', () => {
      expect(parseTL('₺1.234,56 TL')).toBe(123456)
      expect(parseTL('₺ 1.234,56')).toBe(123456)
      expect(parseTL('1.234,56 TRY')).toBe(123456)
    })

    it('handles negative amounts', () => {
      expect(parseTL('-50')).toBe(-5000)
      expect(parseTL('-1.234,56')).toBe(-123456)
      expect(parseTL('−1.234,56')).toBe(-123456) // Unicode minus
    })

    it('parses small decimal amounts', () => {
      expect(parseTL('12,5')).toBe(1250)
      expect(parseTL('0,5')).toBe(50)
    })

    it('returns null for empty or invalid input', () => {
      expect(parseTL('')).toBe(null)
      expect(parseTL('   ')).toBe(null)
      expect(parseTL('abc')).toBe(null)
      expect(parseTL('NaN')).toBe(null)
    })

    it('parses comma-separated multiple commas removes all commas', () => {
      // "1,2,3" has multiple commas so split(',').length > 2, treats as "123" = 123 ₺
      expect(parseTL('1,2,3')).toBe(12300)
    })

    it('handles edge cases', () => {
      expect(parseTL('0')).toBe(0)
      expect(parseTL('0,00')).toBe(0)
      expect(parseTL('00.000,00')).toBe(0)
      expect(parseTL('+50')).toBe(5000)
    })
  })

  describe('formatTL', () => {
    it('formats kuruş as whole lira with Turkish locale', () => {
      const result = formatTL(123456)
      // 1234.56 rounds to 1235
      expect(result).toMatch(/1\.235\s*₺/)
      expect(result).toContain('₺')
    })

    it('rounds to whole lira', () => {
      const result = formatTL(123456)
      expect(result).not.toContain(',')
      // May have thousands separator (.)
    })

    it('handles zero', () => {
      const result = formatTL(0)
      expect(result).toBe('0 ₺')
    })

    it('handles negative amounts', () => {
      const result = formatTL(-123456)
      expect(result).toContain('-')
      expect(result).toContain('₺')
    })
  })

  describe('formatTLExact', () => {
    it('formats kuruş as decimal lira with Turkish locale', () => {
      const result = formatTLExact(123456)
      // Should be "1.234,56 ₺" with Turkish number formatting
      expect(result).toMatch(/1\.234,56\s*₺/)
      expect(result).toContain('₺')
    })

    it('includes fractional kuruş (minimized decimals)', () => {
      const result = formatTLExact(1250)
      // Intl.NumberFormat minimizes trailing zeros
      expect(result).toMatch(/12,5\s*₺/)
    })

    it('handles whole amounts (no forced decimals)', () => {
      const result = formatTLExact(123400)
      // Intl.NumberFormat with minimumFractionDigits: 0 skips .00
      expect(result).toMatch(/1\.234\s*₺/)
    })

    it('handles zero', () => {
      const result = formatTLExact(0)
      expect(result).toMatch(/0\s*₺/)
    })

    it('handles negative amounts', () => {
      const result = formatTLExact(-123456)
      expect(result).toContain('-')
      expect(result).toContain('₺')
    })
  })

  describe('formatInput', () => {
    it('formats kuruş as decimal for input fields', () => {
      const result = formatInput(123456)
      expect(result).toBe('1.234,56')
    })

    it('includes thousands and decimal separators', () => {
      const result = formatInput(1234567)
      expect(result).toMatch(/\d+\.\d+,\d+/)
    })

    it('handles zero', () => {
      const result = formatInput(0)
      // Intl.NumberFormat minimizes trailing zeros
      expect(result).toBe('0')
    })
  })
})
