import { describe, it, expect } from 'vitest'
import { merchantKey, suggestCategory } from './categorize'
import { DEFAULT_CATEGORIES } from '../domain/categories'
import type { Category, MerchantRule } from '../domain/types'

describe('merchantKey', () => {
  it('lowercases, strips diacritics and punctuation, and drops city tokens and digits', () => {
    expect(merchantKey('MONEYPAY/YEMEK')).toBe('moneypay yemek')
    expect(merchantKey('ASYA TEKEL KURUYEMİŞ ANKARA TR')).toBe('asya tekel kuruyemis')
    expect(merchantKey('  Uber Eats Yemek Istanbul TR 12345 ')).toBe('uber eats yemek')
  })

  it('returns an empty string for empty input', () => {
    expect(merchantKey('   ')).toBe('')
  })
})

describe('suggestCategory', () => {
  const cats = DEFAULT_CATEGORIES

  it('uses the keyword table for common merchants', () => {
    expect(suggestCategory('MONEYPAY/YEMEK', null, [], cats)).toBe('yemek')
    expect(suggestCategory('MONEYPAY/MIGROSONE', null, [], cats)).toBe('market')
    expect(suggestCategory('S/TRENDYOL', null, [], cats)).toBe('giyim')
    expect(suggestCategory('TURK TELEKOM FATURA', null, [], cats)).toBe('fatura')
    expect(suggestCategory('apple.com/bill', null, [], cats)).toBe('abonelik')
    expect(suggestCategory('ORNEK ECZANE ANKARA', null, [], cats)).toBe('saglik')
  })

  it('tells Uber Eats (food) from plain Uber (transport)', () => {
    expect(suggestCategory('Uber Eats Yemek Istanbul TR', null, [], cats)).toBe('yemek')
    expect(suggestCategory('UBER BV', null, [], cats)).toBe('ulasim')
  })

  it('matches short keywords only as whole tokens', () => {
    expect(suggestCategory('ORNEK BIM', null, [], cats)).toBe('market')
    expect(suggestCategory('ORNEK SOKAK KAFE', null, [], cats)).toBe('yemek')
    expect(suggestCategory('ORNEK SOKAK', null, [], cats)).toBe('diger')
  })

  it('maps the bank category by name, case and diacritics insensitive', () => {
    expect(suggestCategory('ORNEK XYZ', 'Market', [], cats)).toBe('market')
    expect(suggestCategory('ORNEK XYZ', 'EĞİTİM', [], cats)).toBe('egitim')
  })

  it('prefers a learned rule over the bank category and the keyword table', () => {
    const rules: MerchantRule[] = [
      { id: 'a', pattern: 'moneypay', categoryId: 'eglence', hits: 9 },
      { id: 'b', pattern: 'moneypay yemek', categoryId: 'giyim', hits: 1 },
    ]
    expect(suggestCategory('MONEYPAY/YEMEK', 'Market', rules, cats)).toBe('giyim')
  })

  it('breaks rule ties by hits when the patterns are the same length', () => {
    const rules: MerchantRule[] = [
      { id: 'a', pattern: 'abcd', categoryId: 'eglence', hits: 2 },
      { id: 'b', pattern: 'efgh', categoryId: 'giyim', hits: 5 },
    ]
    expect(suggestCategory('ORNEK ABCD EFGH', null, rules, cats)).toBe('giyim')
  })

  it('ignores archived categories and falls back to diger', () => {
    const archived: Category[] = cats.map((c) => (c.id === 'yemek' ? { ...c, archived: true } : c))
    expect(suggestCategory('MONEYPAY/YEMEK', null, [], archived)).toBe('diger')
    const rules: MerchantRule[] = [{ id: 'a', pattern: 'moneypay', categoryId: 'yemek', hits: 3 }]
    expect(suggestCategory('MONEYPAY/YEMEK', null, rules, archived)).toBe('diger')
  })

  it('uses a user-created category when the bank category names it', () => {
    const custom: Category[] = [...cats, { id: 'kahve-x', name: 'Kahve', hue: 10, builtin: false, order: 11 }]
    expect(suggestCategory('ORNEK XYZ', 'kahve', [], custom)).toBe('kahve-x')
  })

  it('returns diger for unknown merchants and empty descriptions', () => {
    expect(suggestCategory('ORNEK BILINMEYEN', null, [], cats)).toBe('diger')
    expect(suggestCategory('', undefined, [], cats)).toBe('diger')
  })
})
