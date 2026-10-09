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
      [null, 'Kart Ödemesi'],
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

/** Regression cases from the real-screenshot evaluation. All data is invented. */
describe('regressions', () => {
  it('1. a category starting with "Mar" in the date column is not a month', () => {
    const r = parsePage(
      makePage(
        { t: '02', x: 40, y: 300 },
        { t: 'EYL', x: 40, y: 320 },
        { t: '2026', x: 40, y: 340 },
        { t: 'ORNEK ODEME', x: 220, y: 300 },
        { t: '45,00 TL', right: 960, y: 300 },
        // Row with the category cropped into the date column, no month printed
        { t: '23', x: 40, y: 500 },
        { t: 'Market', x: 40, y: 520 },
        { t: 'ORNEK MARKET', x: 220, y: 500 },
        { t: '45,00 TL', right: 960, y: 500 },
      ),
      TODAY,
    )
    expect(r.txns[1].date).toBe('2026-09-23')
    expect(r.txns[1].date).not.toBe('2026-03-23')
  })

  it('2. split "Toplam" headers and USD/zero amounts never become debits', () => {
    const r = parsePage(
      makePage(
        { t: 'Toplam USD', right: 960, y: 100 },
        { t: 'Harcama Tutarı', right: 960, y: 120 },
        { t: '0,00 USD', right: 960, y: 140 },
        { t: 'Toplam', x: 40, y: 200 },
        { t: '12,50 TL', right: 960, y: 220 },
        { t: '30', x: 40, y: 400 },
        { t: 'EKİ', x: 40, y: 420 },
        { t: '2026', x: 40, y: 440 },
        { t: 'ORNEK KAFE ANKARA TR', x: 220, y: 400 },
        { t: '60,00 TL', right: 960, y: 400 },
      ),
      TODAY,
    )
    expect(r.txns.map((t) => t.amount)).toEqual([6000])
    expect(r.txns.some((t) => t.amount === 0)).toBe(false)
  })

  it('3. a credit row carries no bank category', () => {
    const r = parsePage(garantiPage(), TODAY)
    expect(r.txns[2].direction).toBe('credit')
    expect(r.txns[2].bankCategory).toBeNull()
  })

  it('4. Ziraat Dinamik is detected from the Provizyondaki tab without BANKKART', () => {
    const p = makePage(
      { t: 'Dönem İçi Hareketler', x: 40, y: 60 },
      { t: 'Bekleyen Taksitler', x: 300, y: 60 },
      { t: 'Provizyondaki İşlemler', x: 600, y: 60 },
    )
    expect(detectProfile(p)).toBe('ziraat-dinamik')
    const b = makePage(
      { t: 'BANKKART', x: 40, y: 20 },
      { t: 'Provizyondaki İşlemler', x: 600, y: 60 },
    )
    expect(detectProfile(b)).toBe('ziraat-bankkart')
  })

  it('5. an installment split over four lines is read from the whole row', () => {
    const r = parsePage(
      makePage(
        { t: '02', x: 40, y: 300 },
        { t: 'EYL', x: 40, y: 320 },
        { t: '2026', x: 40, y: 340 },
        { t: '06/08 S/TRENDYOL', x: 220, y: 300 },
        { t: '-376,83 TL', right: 960, y: 300 },
        { t: '03.Tak ISTANB', x: 220, y: 320 },
        { t: '(1130,49 TL İşlemin', x: 220, y: 340 },
        { t: '3/3 Taksidi)', x: 220, y: 360 },
      ),
      TODAY,
    )
    expect(r.txns).toHaveLength(1)
    expect(r.txns[0].installment).toEqual({ index: 3, count: 3, total: 113049 })
    expect(r.txns[0].amount).toBe(37683)
  })

  it('6. a cut-off last row borrows month and year from the previous row', () => {
    const r = parsePage(
      makePage(
        { t: '02', x: 40, y: 300 },
        { t: 'EYL', x: 40, y: 320 },
        { t: '2026', x: 40, y: 340 },
        { t: 'ORNEK MARKET', x: 220, y: 300 },
        { t: '10,00 TL', right: 960, y: 300 },
        { t: '27', x: 40, y: 500 },
        { t: 'ORNEK KAFE', x: 220, y: 500 },
        { t: '20,00 TL', right: 960, y: 500 },
      ),
      TODAY,
    )
    expect(r.txns[1].date).toBe('2026-09-27')
    expect(r.txns[1].confidence).toBe(0.8)
  })

  it('7. a missing day leaves the date null, and a day above the month is attached', () => {
    const r = parsePage(
      makePage(
        { t: 'ORNEK ISTANBUL TR', x: 220, y: 280 },
        { t: 'Eki', x: 40, y: 300 },
        { t: '12:05', x: 40, y: 320 },
        { t: '-100,00 TL', x: 220, y: 320 },
        { t: '9', x: 40, y: 500 },
        { t: 'ORNEK MAGAZA ANKARA TR', x: 220, y: 500 },
        { t: 'Eki', x: 40, y: 520 },
        { t: '12:05', x: 40, y: 540 },
        { t: '-200,00 TL', x: 220, y: 540 },
      ),
      TODAY,
    )
    expect(r.txns[0].date).toBeNull()
    expect(r.txns[0].confidence).toBe(0.7)
    expect(r.txns[1].date).toBe('2026-10-09')
  })
})

describe('row band', () => {
  it('8. an installment line far below the row date still belongs to that row', () => {
    // Vertical layout as read from a real Ziraat Dinamik screen: the "3/3 Taksidi)" line sits
    // about 86px under the row's amount line, past the usual reach, but above the next row's top.
    const r = parsePage(
      makePage(
        { t: '06/08 ORNEK MARKET', x: 220, y: 1000 },
        { t: '06', x: 40, y: 1020 },
        { t: '03.Tak ORNEK', x: 220, y: 1020 },
        { t: '376,83 TL', right: 960, y: 1020 },
        { t: 'EKİ', x: 40, y: 1040 },
        { t: '2026', x: 40, y: 1060 },
        { t: '(1130,49 TL İşlemin', x: 220, y: 1060 },
        { t: '3/3 Taksidi)', x: 220, y: 1126 },
        { t: '05', x: 40, y: 1244 },
        { t: 'EKİ', x: 40, y: 1264 },
        { t: '2026', x: 40, y: 1284 },
        { t: 'MONEYPAY/YEMEK', x: 220, y: 1244 },
        { t: '289,99 TL', right: 960, y: 1262 },
      ),
      TODAY,
    )
    expect(r.txns).toHaveLength(2)
    expect(r.txns[0].installment).toEqual({ index: 3, count: 3, total: 113049 })
    expect(r.txns[0].date).toBe('2026-10-06')
    expect(r.txns[1].installment).toBeNull()
  })
})

describe('row starts at a day token', () => {
  it('9. a transfer row with no amount starts its own row and does not swallow the row above', () => {
    const r = parsePage(
      makePage(
        { t: 'Thecof Ankara TR - 21:23', x: 220, y: 280 },
        { t: '3', x: 40, y: 280 },
        { t: 'Eki', x: 40, y: 300 },
        { t: '21:23', x: 40, y: 320 },
        { t: '-190,00 TL', x: 220, y: 320 },
        // Transfer row: day "2" alone, then the description line (no amount, cut by the tab bar)
        { t: '2', x: 40, y: 420 },
        { t: '£ 9519 Karttan Aktarım 2100/3651416 İscep -', x: 220, y: 440 },
      ),
      TODAY,
    )
    expect(r.txns).toHaveLength(1)
    expect(r.txns[0].amount).toBe(19000)
    expect(r.txns[0].description).toBe('Thecof Ankara TR')
    expect(r.txns[0].date).toBe('2026-10-03')
    expect(r.skipped.some((s) => s.includes('Karttan'))).toBe(true)
  })
})
