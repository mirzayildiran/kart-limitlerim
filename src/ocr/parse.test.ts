import { describe, it, expect } from 'vitest'
import { detectProfile, parsePage } from './parse'
import {
  TODAY,
  akbankPage,
  garantiPage,
  isbankPage,
  makePage,
  ziraatBankkartPage,
  ziraatDinamikPage,
} from './testFixtures'
import type { ParsedTxn } from './types'

/** Compact view of the parts a test cares about. */
const summary = (txns: ParsedTxn[]) =>
  txns.map((t) => [t.date, t.description, t.amount, t.direction])

describe('detectProfile', () => {
  it('recognises each bank layout by its cues', () => {
    expect(detectProfile(ziraatDinamikPage())).toBe('ziraat-dinamik')
    expect(detectProfile(ziraatBankkartPage())).toBe('ziraat-bankkart')
    expect(detectProfile(akbankPage())).toBe('akbank')
    expect(detectProfile(isbankPage())).toBe('isbank')
    expect(detectProfile(garantiPage())).toBe('garanti')
  })

  it('falls back to generic when no cue is present', () => {
    const p = akbankPage()
    const stripped = { ...p, words: p.words.filter((w) => !['Kredi', 'kartı', 'Gelecek', 'dönem'].includes(w.text)) }
    expect(detectProfile(stripped)).toBe('generic')
  })
})

describe('parsePage: Ziraat Dinamik', () => {
  const r = parsePage(ziraatDinamikPage(), TODAY)

  it('reads rows, skips totals, and keeps the installment total out of the rows', () => {
    expect(r.profile).toBe('ziraat-dinamik')
    expect(summary(r.txns)).toEqual([
      ['2026-10-06', 'ORNEK MARKET ANKARA TR', 37683, 'debit'],
      ['2026-09-02', 'ORNEK ELEKTRONIK TR', 37683, 'debit'],
      ['2026-10-05', 'MONEYPAY/YEMEK', 28999, 'debit'],
      ['2026-10-04', 'ODEME - TESEKKUR EDERIZ', 25000, 'credit'],
    ])
    expect(r.skipped.some((s) => s.includes('Toplam TL Harcama Tutarı 3.844,73'))).toBe(true)
    expect(r.skipped.some((s) => s.includes('Toplam Usd'))).toBe(true)
  })

  it('reads the installment index, count and total from the split OCR lines', () => {
    expect(r.txns[1].installment).toEqual({ index: 3, count: 3, total: 113049 })
    expect(r.txns[0].installment).toBeNull()
  })

  it('marks no row as pending and gives clean rows full confidence', () => {
    expect(r.txns.every((t) => !t.pending)).toBe(true)
    expect(r.txns[0].confidence).toBe(1)
  })
})

describe('parsePage: Ziraat Bankkart', () => {
  const r = parsePage(ziraatBankkartPage(), TODAY)

  it('reads stacked dates, glued TL, and treats "*" as a credit', () => {
    expect(r.profile).toBe('ziraat-bankkart')
    expect(summary(r.txns)).toEqual([
      ['2026-09-28', 'ORNEK MAGAZA IZMIR TR', 162000, 'debit'],
      ['2026-09-27', 'S/TRENDYOL', 24990, 'debit'],
      ['2026-09-25', 'Ödeme - Teşekkür Ederiz', 129783, 'credit'],
      ['2026-09-24', 'ORNEK CAFE ANKARA TR', 9000, 'debit'],
    ])
  })

  it('ignores the tab bar', () => {
    expect(r.skipped.some((s) => s.includes('Hesaplarım'))).toBe(false)
  })
})

describe('parsePage: Akbank', () => {
  const r = parsePage(akbankPage(), TODAY)

  it('pairs each amount line with the date printed below it', () => {
    expect(r.profile).toBe('akbank')
    expect(summary(r.txns)).toEqual([
      ['2026-10-07', 'MONEYPAY/YEMEK', 40499, 'debit'],
      ['2026-10-06', 'ASYA TEKEL KURUYEMİŞ ANKARA TR', 22500, 'debit'],
      ['2026-10-06', 'TÜRKAN ULUDAĞ ANKARA TR', 9000, 'debit'],
      ['2026-10-05', 'MONEYPAY/MIGROSONE', 32243, 'debit'],
    ])
  })

  it('does not read the tab labels as rows', () => {
    expect(r.txns.some((t) => /Bekleyen|Dönem/.test(t.description))).toBe(false)
  })
})

describe('parsePage: İş Bankası', () => {
  const r = parsePage(isbankPage(), TODAY)

  it('reads amounts under the description, glued days, and dot or comma decimals', () => {
    expect(r.profile).toBe('isbank')
    expect(summary(r.txns)).toEqual([
      ['2026-10-10', 'Uber Eats Yemek İstanbul TR', 43000, 'debit'],
      ['2026-10-09', 'ORNEK MAGAZA ISTANBUL TR', 68000, 'debit'],
      ['2025-12-28', 'ORNEK ELEKTRONIK ANKARA', 40900, 'debit'],
      ['2026-09-12', 'ORNEK KİTAPÇI ANKARA TR', 15000, 'debit'],
    ])
  })

  it('sets pending from the section headers', () => {
    expect(r.txns.map((t) => t.pending)).toEqual([true, true, true, false])
  })

  it('resolves dates without a year against today', () => {
    const later = parsePage(isbankPage(), new Date(2027, 0, 5))
    expect(later.txns[2].date).toBe('2026-12-28')
  })

  it('skips the card transfer and the summary total', () => {
    expect(r.txns.length).toBe(4)
    expect(r.skipped.some((s) => s.includes('Karttan'))).toBe(true)
    expect(r.skipped.some((s) => s.includes('Toplam'))).toBe(true)
  })
})

describe('parsePage: Garanti', () => {
  const r = parsePage(garantiPage(), TODAY)

  it('splits the bank category from the merchant', () => {
    expect(r.profile).toBe('garanti')
    expect(r.txns.map((t) => [t.bankCategory, t.description])).toEqual([
      ['Eğitim', 'ORNEK KURSU ANKARA'],
      ['Market', 'ORNEK MARKET'],
      ['Diğer', 'Kart Ödemesi'],
    ])
  })

  it('reads amounts, directions, and the inferred month of the last row', () => {
    expect(summary(r.txns)).toEqual([
      ['2026-09-30', 'ORNEK KURSU ANKARA', 9000, 'debit'],
      ['2026-09-29', 'ORNEK MARKET', 24550, 'debit'],
      ['2026-09-28', 'Kart Ödemesi', 10500, 'credit'],
    ])
    expect(r.txns[0].confidence).toBe(1)
    expect(r.txns[2].confidence).toBe(0.8)
  })

  it('skips the promo and the action buttons', () => {
    expect(r.txns.length).toBe(3)
    expect(r.skipped.some((s) => s.includes('Bonus'))).toBe(true)
  })
})

describe('parsePage: generic fallback and confidence', () => {
  it('parses an unknown layout with the generic rules', () => {
    const p = akbankPage()
    const stripped = { ...p, words: p.words.filter((w) => !['Kredi', 'kartı', 'Gelecek', 'dönem'].includes(w.text)) }
    const r = parsePage(stripped, TODAY)
    expect(r.profile).toBe('generic')
    expect(r.txns.map((t) => t.amount)).toEqual([40499, 22500, 9000, 32243])
  })

  it('lowers confidence for a missing date and low OCR confidence', () => {
    const noDate = makePage({ t: 'ORNEK MAGAZA ANKARA TR', x: 220, y: 300, conf: 60 }, { t: '12,00 TL', right: 960, y: 300, conf: 60 })
    const r = parsePage(noDate, TODAY)
    expect(r.txns[0].date).toBeNull()
    expect(r.txns[0].confidence).toBeCloseTo(0.5)
  })

  it('lowers confidence for an empty description', () => {
    const r = parsePage(
      makePage(
        { t: '10', x: 40, y: 300 },
        { t: 'Eki', x: 40, y: 320 },
        { t: '2026', x: 40, y: 340 },
        { t: '12,00 TL', right: 960, y: 300 },
      ),
      TODAY,
    )
    expect(r.txns[0].description).toBe('')
    expect(r.txns[0].confidence).toBeCloseTo(0.8)
  })
})
