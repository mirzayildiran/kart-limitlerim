import type { IsoDate } from './types'

/**
 * Turkish public holidays, for moving an estimated due date off a non-business day.
 *
 * BDDK, "Banka Kartları ve Kredi Kartları Hakkında Yönetmelik": when the last payment date falls
 * on a weekend or an official holiday, payment on the next business day counts as on time.
 *
 * Sources (checked 2026-10-10):
 * - Fixed days: 2429 sayılı Ulusal Bayram ve Genel Tatiller Hakkında Kanun, md. 1–2.
 * - Religious holidays: Diyanet İşleri Başkanlığı, "Dini Günler" lists for 2026, 2027 and 2028
 *   (vakithesaplama.diyanet.gov.tr). Diyanet dates for years ahead are computed and may be
 *   adjusted; check the 2028 rows again when Diyanet publishes that year's calendar.
 *
 * Arife (eve) days are half-day holidays: banks and payment systems work in the morning, so a
 * due date on an arife is not moved. They are listed (half: true) so the table is complete.
 * Outside the listed years only the fixed days and weekends are known.
 */

interface Holiday {
  date: IsoDate
  name: string
  /** Half-day holiday (afternoon off); still a business day for payments. */
  half?: boolean
}

/** Month-day of the fixed national holidays, valid for every year. */
const FIXED: { md: string; name: string; half?: boolean }[] = [
  { md: '01-01', name: 'Yılbaşı' },
  { md: '04-23', name: 'Ulusal Egemenlik ve Çocuk Bayramı' },
  { md: '05-01', name: 'Emek ve Dayanışma Günü' },
  { md: '05-19', name: "Atatürk'ü Anma, Gençlik ve Spor Bayramı" },
  { md: '07-15', name: 'Demokrasi ve Milli Birlik Günü' },
  { md: '08-30', name: 'Zafer Bayramı' },
  { md: '10-28', name: 'Cumhuriyet Bayramı arifesi', half: true },
  { md: '10-29', name: 'Cumhuriyet Bayramı' },
]

function feast(name: string, arife: IsoDate, days: IsoDate[]): Holiday[] {
  return [{ date: arife, name: `${name} arifesi`, half: true }, ...days.map((date, i) => ({ date, name: `${name} ${i + 1}. gün` }))]
}

const RAMAZAN = 'Ramazan Bayramı'
const KURBAN = 'Kurban Bayramı'

/** Religious holidays by year (Diyanet). */
const RELIGIOUS: Record<number, Holiday[]> = {
  2026: [
    ...feast(RAMAZAN, '2026-03-19', ['2026-03-20', '2026-03-21', '2026-03-22']),
    ...feast(KURBAN, '2026-05-26', ['2026-05-27', '2026-05-28', '2026-05-29', '2026-05-30']),
  ],
  2027: [
    ...feast(RAMAZAN, '2027-03-08', ['2027-03-09', '2027-03-10', '2027-03-11']),
    ...feast(KURBAN, '2027-05-15', ['2027-05-16', '2027-05-17', '2027-05-18', '2027-05-19']),
  ],
  2028: [
    ...feast(RAMAZAN, '2028-02-25', ['2028-02-26', '2028-02-27', '2028-02-28']),
    ...feast(KURBAN, '2028-05-04', ['2028-05-05', '2028-05-06', '2028-05-07', '2028-05-08']),
  ],
}

/** First and last year with religious holidays in the table. */
export const HOLIDAY_YEARS = { from: 2026, to: 2028 } as const

/** Every listed holiday of a year, in date order. A date may appear twice (19 May 2027). */
export function holidaysOf(year: number): Holiday[] {
  const fixed = FIXED.map((f) => ({ date: `${year}-${f.md}`, name: f.name, ...(f.half ? { half: true } : {}) }))
  return [...fixed, ...(RELIGIOUS[year] ?? [])].sort((a, b) => a.date.localeCompare(b.date))
}

const fullDays = new Map<number, Set<IsoDate>>()

function fullHolidays(year: number): Set<IsoDate> {
  let set = fullDays.get(year)
  if (!set) {
    set = new Set(holidaysOf(year).filter((h) => !h.half).map((h) => h.date))
    fullDays.set(year, set)
  }
  return set
}

function iso(d: Date): IsoDate {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** A full-day official holiday (arife half days are not). */
export function isHoliday(d: Date): boolean {
  return fullHolidays(d.getFullYear()).has(iso(d))
}

/** Monday to Friday and not a full-day holiday. */
export function isBusinessDay(d: Date): boolean {
  const wd = d.getDay()
  return wd !== 0 && wd !== 6 && !isHoliday(d)
}

/** The day itself when it is a business day, else the first business day after it. */
export function nextBusinessDay(d: Date): Date {
  let day = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  // A long bayram plus a weekend is at most 9 days; the bound only guards against a bad table.
  for (let i = 0; i < 15 && !isBusinessDay(day); i++) day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)
  return day
}
