import { describe, it, expect } from 'vitest'
import {
  backupFileName,
  canDeleteCategory,
  cardRateLines,
  cashRateLine,
  checkCategoryName,
  formatLongDate,
  formatPercent,
  isCategoryInUse,
  minimumLine,
  sourceLine,
  taxLine,
} from './settingsModel'
import type { RateTable } from '../../domain/rates'

/** Invented fixtures only. */

describe('backupFileName', () => {
  it('uses the local calendar date with zero padding', () => {
    expect(backupFileName(new Date(2026, 0, 5, 23, 59))).toBe('kart-limitlerim-yedek-2026-01-05.json')
  })
  it('keeps two-digit months and days', () => {
    expect(backupFileName(new Date(2026, 9, 10, 8, 0))).toBe('kart-limitlerim-yedek-2026-10-10.json')
  })
})

describe('formatPercent', () => {
  it('uses a Turkish decimal comma and drops trailing zeros', () => {
    expect(formatPercent(3.25)).toBe('3,25')
    expect(formatPercent(4)).toBe('4')
    expect(formatPercent(20)).toBe('20')
  })
  it('rounds floating noise from percentage conversion', () => {
    expect(formatPercent(0.15 * 100)).toBe('15')
  })
})

describe('formatLongDate', () => {
  it('writes the Turkish month name', () => {
    expect(formatLongDate('2026-10-01')).toBe('1 Ekim 2026')
    expect(formatLongDate('2027-03-15')).toBe('15 Mart 2027')
  })
})

describe('rate rows', () => {
  it('formats the three card tiers with open, closed and unbounded ranges', () => {
    expect(cardRateLines()).toEqual([
      '30.000 ₺ altı: akdi %3,25 · gecikme %3,55',
      '30.000 ₺ – 180.000 ₺ arası: akdi %3,75 · gecikme %4,05',
      '180.000 ₺ üzeri: akdi %4,25 · gecikme %4,55',
    ])
  })

  it('handles a table with a single unbounded tier', () => {
    const table: RateTable = {
      effective: '2026-01-01',
      source: 'test',
      reference: 1,
      cardTiers: [{ upTo: null, inclusive: false, contractual: 2, late: 2.5 }],
      cash: { contractual: 3, late: 3.5 },
      foreignCurrency: { contractual: 1, late: 1 },
    }
    expect(cardRateLines(table)).toEqual(['Tüm limitler: akdi %2 · gecikme %2,5'])
  })

  it('formats the cash and KMH line', () => {
    expect(cashRateLine()).toBe('Nakit çekim ve KMH: akdi %4,25 · gecikme %4,55')
  })

  it('formats the interest tax line', () => {
    expect(taxLine()).toBe('KKDF %15 + BSMV %15')
  })

  it('formats the minimum payment rule with the 100.000 ₺ threshold', () => {
    expect(minimumLine()).toBe("Asgari ödeme: limit 100.000 ₺'ye kadar %20, üstü %40")
  })

  it('formats the source line with the effective date', () => {
    expect(sourceLine('BDDK karar no. 11581', '2026-10-01')).toBe(
      'Kaynak: BDDK karar no. 11581, 1 Ekim 2026 itibarıyla geçerli',
    )
  })
})

describe('checkCategoryName', () => {
  const others = [
    { id: 'yemek', name: 'Yemek' },
    { id: 'ulasim', name: 'Ulaşım' },
    { id: 'cat_a', name: 'Hobi' },
  ]

  it('trims and collapses inner spaces', () => {
    expect(checkCategoryName('  Ev   işi ', others)).toEqual({ ok: true, name: 'Ev işi' })
  })

  it('rejects an empty name', () => {
    expect(checkCategoryName('   ', others).ok).toBe(false)
  })

  it('accepts exactly 24 characters and rejects 25', () => {
    expect(checkCategoryName('a'.repeat(24), others).ok).toBe(true)
    const r = checkCategoryName('a'.repeat(25), others)
    expect(r.ok).toBe(false)
  })

  it('counts characters, not UTF-16 units', () => {
    expect(checkCategoryName('😀'.repeat(24), others).ok).toBe(true)
  })

  it('rejects duplicates case-insensitively with Turkish rules', () => {
    expect(checkCategoryName('YEMEK', others).ok).toBe(false)
    expect(checkCategoryName('ULAŞIM', others).ok).toBe(false)
    expect(checkCategoryName('ulaşım', others).ok).toBe(false)
  })

  it('does not treat a category as a duplicate of itself', () => {
    expect(checkCategoryName('Yemek', others, 'yemek')).toEqual({ ok: true, name: 'Yemek' })
  })
})

describe('canDeleteCategory', () => {
  it('never deletes builtin categories', () => {
    expect(canDeleteCategory({ builtin: true }, false)).toBe(false)
  })
  it('deletes a user category only when nothing uses it', () => {
    expect(canDeleteCategory({ builtin: false }, false)).toBe(true)
    expect(canDeleteCategory({ builtin: false }, true)).toBe(false)
  })
})

describe('isCategoryInUse', () => {
  it('is true when an expense or a recurring payment points at the category', () => {
    expect(isCategoryInUse('cat_x', [{ categoryId: 'cat_x' }], [])).toBe(true)
    expect(isCategoryInUse('cat_x', [], [{ categoryId: 'cat_x' }])).toBe(true)
  })
  it('is false when nothing points at it', () => {
    expect(isCategoryInUse('cat_x', [{ categoryId: 'yemek' }], [{ categoryId: 'kira' }])).toBe(false)
  })
})
