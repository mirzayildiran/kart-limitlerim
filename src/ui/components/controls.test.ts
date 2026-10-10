import { describe, it, expect } from 'vitest'
import { moneyTextOnBlur } from './controls'

describe('moneyTextOnBlur', () => {
  it('groups a whole amount with Turkish thousands separators', () => {
    expect(moneyTextOnBlur('1250')).toBe('1.250')
    expect(moneyTextOnBlur('1.250')).toBe('1.250')
    expect(moneyTextOnBlur('1234567')).toBe('1.234.567')
  })

  it('keeps kuruş with a decimal comma and two digits', () => {
    expect(moneyTextOnBlur('1250,5')).toBe('1.250,50')
    expect(moneyTextOnBlur('1250,50')).toBe('1.250,50')
    expect(moneyTextOnBlur('12.5')).toBe('12,50')
  })

  it('leaves small amounts and zero as they read', () => {
    expect(moneyTextOnBlur('250')).toBe('250')
    expect(moneyTextOnBlur('0')).toBe('0')
  })

  it('keeps text that is not an amount as typed, and empty stays empty', () => {
    expect(moneyTextOnBlur('12a')).toBe('12a')
    expect(moneyTextOnBlur('')).toBe('')
    expect(moneyTextOnBlur('   ')).toBe('   ')
  })
})
