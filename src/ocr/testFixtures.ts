import type { OcrPage, OcrWord } from './types'

/** Synthetic screenshots: invented merchants and names only. Coordinates imitate real OCR output. */

export const TODAY = new Date(2026, 9, 10)
const PAGE_WIDTH = 1000
const CHAR_W = 12
const GAP = 10
const WORD_H = 20

/** One OCR line. `x` is the left edge; `right` places the line's right edge instead. */
interface Ln {
  t: string
  y: number
  x?: number
  right?: number
  conf?: number
}

function wordsOf(ln: Ln): OcrWord[] {
  const parts = ln.t.split(' ')
  const widths = parts.map((p) => [...p].length * CHAR_W)
  const total = widths.reduce((a, b) => a + b, 0) + GAP * (parts.length - 1)
  let x = ln.right !== undefined ? ln.right - total : (ln.x ?? 0)
  return parts.map((p, i) => {
    const w: OcrWord = { text: p, x0: x, y0: ln.y, x1: x + widths[i], y1: ln.y + WORD_H, confidence: ln.conf ?? 95 }
    x = w.x1 + GAP
    return w
  })
}

export function makePage(...lines: Ln[]): OcrPage {
  return { width: PAGE_WIDTH, height: 2000, words: lines.flatMap(wordsOf) }
}

/** Ziraat Dinamik: stacked date left, description middle, amount right; installment total on its own lines. */
export function ziraatDinamikPage(): OcrPage {
  return makePage(
    { t: 'ZiraatDinamik', x: 40, y: 40 },
    { t: 'Toplam TL Harcama Tutarı 3.844,73', right: 960, y: 100 },
    { t: 'Toplam Usd Harcama Tutarı 0,00', right: 960, y: 140 },
    { t: 'Dönem İçi Hareketler', x: 40, y: 180 },
    { t: 'Provizyondaki', x: 400, y: 180 },
    // Row A
    { t: '06', x: 40, y: 300 },
    { t: 'EKİ', x: 40, y: 320 },
    { t: '2026', x: 40, y: 340 },
    { t: 'ORNEK MARKET ANKARA TR', x: 220, y: 300 },
    { t: '376,83 TL', right: 960, y: 300 },
    // Row B: installment, total printed without thousands dot and split over two lines
    { t: '02', x: 40, y: 480 },
    { t: 'EYL', x: 40, y: 500 },
    { t: '2026', x: 40, y: 520 },
    { t: 'ORNEK ELEKTRONIK TR', x: 220, y: 480 },
    { t: '376,83 TL', right: 960, y: 480 },
    { t: '03.Tak', x: 220, y: 500 },
    { t: '(1130,49 TL İşlemin', x: 220, y: 520 },
    { t: '3/3 Taksidi)', x: 220, y: 540 },
    // Row C
    { t: '05', x: 40, y: 700 },
    { t: 'EKİ', x: 40, y: 720 },
    { t: '2026', x: 40, y: 740 },
    { t: 'MONEYPAY/YEMEK', x: 220, y: 700 },
    { t: '289,99 TL', right: 960, y: 700 },
    // Row D: credit
    { t: '04', x: 40, y: 860 },
    { t: 'EKİ', x: 40, y: 880 },
    { t: '2026', x: 40, y: 900 },
    { t: 'ODEME - TESEKKUR EDERIZ', x: 220, y: 860 },
    { t: '+250,00 TL', right: 960, y: 860 },
  )
}

/** Ziraat Bankkart: stacked date, "*" used for the plus sign, glued TL, tab bar noise at the bottom. */
export function ziraatBankkartPage(): OcrPage {
  return makePage(
    { t: 'BANKKART', x: 40, y: 60 },
    // Row A
    { t: '28', x: 40, y: 250 },
    { t: 'EYL', x: 40, y: 270 },
    { t: '2026', x: 40, y: 290 },
    { t: 'ORNEK MAGAZA IZMIR TR', x: 220, y: 250 },
    { t: '1.620,00 TL', right: 960, y: 250 },
    // Row B
    { t: '27', x: 40, y: 420 },
    { t: 'EYL', x: 40, y: 440 },
    { t: '2026', x: 40, y: 460 },
    { t: 'S/TRENDYOL', x: 220, y: 420 },
    { t: '249,90TL', right: 960, y: 420 },
    // Row C: credit, sign OCR'd as "*"
    { t: '25', x: 40, y: 590 },
    { t: 'EYL', x: 40, y: 610 },
    { t: '2026', x: 40, y: 630 },
    { t: 'Ödeme - Teşekkür Ederiz', x: 220, y: 590 },
    { t: '*1.297,83 TL', right: 960, y: 590 },
    // Row D
    { t: '24', x: 40, y: 760 },
    { t: 'EYL', x: 40, y: 780 },
    { t: '2026', x: 40, y: 800 },
    { t: 'ORNEK CAFE ANKARA TR', x: 220, y: 760 },
    { t: '90,00 TL', right: 960, y: 760 },
    // Bottom tab bar
    { t: 'Ana Sayfa Menü Hesaplarım İşlemler', x: 40, y: 1880 },
  )
}

/** Akbank credit card: description and amount on one line, date below. Tabs: Dönem içi / Bekleyen / Gelecek dönem. */
export function akbankPage(): OcrPage {
  return makePage(
    { t: 'Kredi kartı', x: 380, y: 60 },
    { t: 'Dönem içi', x: 40, y: 120 },
    { t: 'Bekleyen', x: 400, y: 120 },
    { t: 'Gelecek dönem', x: 700, y: 120 },
    { t: 'MONEYPAY/YEMEK', x: 40, y: 300 },
    { t: '404,99 TL', right: 960, y: 300 },
    { t: '07.10.2026', x: 40, y: 335 },
    { t: 'ASYA TEKEL KURUYEMİŞ ANKARA TR', x: 40, y: 470 },
    { t: '225,00 TL', right: 960, y: 470 },
    { t: '06.10.2026', x: 40, y: 505 },
    { t: 'TÜRKAN ULUDAĞ ANKARA TR', x: 40, y: 640 },
    { t: '90,00 TL', right: 960, y: 640 },
    { t: '06.10.2026', x: 40, y: 675 },
    { t: 'MONEYPAY/MIGROSONE', x: 40, y: 810 },
    { t: '322,43 TL', right: 960, y: 810 },
    { t: '05.10.2026', x: 40, y: 845 },
  )
}

/**
 * İş Bankası: amount sits under the description (not on the right), day glued to an icon,
 * "Eki"/"Eyl" month alone, time under it. Sections BEKLEMEDE (pending) and GERÇEKLEŞEN.
 */
export function isbankPage(): OcrPage {
  return makePage(
    { t: 'HESAP ÖZETİ', x: 40, y: 40 },
    { t: 'TAKSİTLER', x: 40, y: 80 },
    { t: 'Dönem İçi Harcamalar Toplamı -26.349,34 TL', right: 960, y: 120 },
    { t: 'BEKLEMEDE', x: 40, y: 240 },
    // Row A: day glued to an icon glyph, description starts with an icon "&"
    { t: '10/5)', x: 40, y: 280 },
    { t: '& Uber Eats Yemek İstanbul TR - 00:28', x: 220, y: 280 },
    { t: 'Eki', x: 40, y: 300 },
    { t: '00:28', x: 40, y: 320 },
    { t: '-430.00 TL', x: 220, y: 320 },
    // Row B: day alone above the month
    { t: '9', x: 40, y: 380 },
    { t: 'ORNEK MAGAZA ISTANBUL TR', x: 220, y: 380 },
    { t: 'Eki', x: 40, y: 400 },
    { t: '12:05', x: 40, y: 420 },
    { t: '-680,00TL', x: 220, y: 420 },
    // Row C: no year printed, previous year rollover
    { t: '28', x: 40, y: 480 },
    { t: 'Ara', x: 40, y: 500 },
    { t: '10:05', x: 40, y: 520 },
    { t: 'ORNEK ELEKTRONIK ANKARA', x: 220, y: 480 },
    { t: '-409,00TL', x: 220, y: 520 },
    { t: 'GERÇEKLEŞEN', x: 40, y: 560 },
    // Row D: booked, month variant "Eyl"
    { t: '12', x: 40, y: 620 },
    { t: 'Eyl', x: 40, y: 640 },
    { t: '12:30', x: 40, y: 660 },
    { t: 'ORNEK KİTAPÇI ANKARA TR', x: 220, y: 620 },
    { t: '-150,00 TL', x: 220, y: 660 },
    // Row E: transfer from card, skipped
    { t: '08', x: 40, y: 720 },
    { t: 'Eki', x: 40, y: 740 },
    { t: '09:00', x: 40, y: 760 },
    { t: '9519 Karttan Aktarım', x: 220, y: 720 },
    { t: '-1.000,00 TL', x: 220, y: 760 },
    { t: 'Ba', x: 40, y: 820 },
  )
}

/**
 * Garanti: category on the same line as the day and the amount, merchant on the next line.
 * Last row prints day and year but no month (inferred from the previous row).
 */
export function garantiPage(): OcrPage {
  return makePage(
    { t: 'Bonus kazan', x: 40, y: 40 },
    { t: 'Son Dönem İçi Hareketleri', x: 40, y: 120 },
    { t: 'Borç Öde', x: 40, y: 200 },
    { t: 'Limit Artırım', x: 400, y: 200 },
    { t: 'Ertele / Taksitlendir', x: 40, y: 240 },
    // Row A
    { t: '30', x: 40, y: 340 },
    { t: 'EYL', x: 40, y: 360 },
    { t: '2026', x: 40, y: 380 },
    { t: 'Eğitim', x: 220, y: 340 },
    { t: '-90,00 TL', right: 960, y: 340 },
    { t: 'ORNEK KURSU ANKARA', x: 220, y: 370 },
    // Row B
    { t: '29', x: 40, y: 520 },
    { t: 'EYL', x: 40, y: 540 },
    { t: '2026', x: 40, y: 560 },
    { t: 'Market', x: 220, y: 520 },
    { t: '-245,50 TL', right: 960, y: 520 },
    { t: 'ORNEK MARKET', x: 220, y: 550 },
    // Row C: credit, "*" sign, no month printed
    { t: '28', x: 40, y: 700 },
    { t: '2026', x: 40, y: 740 },
    { t: 'Diğer', x: 220, y: 700 },
    { t: '*105,00 TL', right: 960, y: 700 },
    { t: 'Kart Ödemesi', x: 220, y: 730 },
  )
}
