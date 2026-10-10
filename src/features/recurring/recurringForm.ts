import { formatLong, fromIso } from '../../domain/dates'
import { formatTL } from '../../domain/money'
import { nextOccurrence } from '../../domain/recurring'
import type { IsoDate, Kurus, RecurrenceEnd, RecurringPayment } from '../../domain/types'

/** Form state and validation for the recurring payment sheet. Pure. */

export type EndKind = 'never' | 'until' | 'count'

export interface RecurringDraft {
  name: string
  amount: Kurus | null
  accountId: string | null
  categoryId: string | null
  dayText: string
  startDate: string
  endKind: EndKind
  untilDate: string
  countText: string
  active: boolean
}

interface RecurringErrors {
  name?: string
  amount?: string
  account?: string
  category?: string
  day?: string
  startDate?: string
  until?: string
  count?: string
}

const ISO = /^\d{4}-\d{2}-\d{2}$/
const MAX_COUNT = 600

export function isIsoDate(s: string): boolean {
  if (!ISO.test(s)) return false
  const d = fromIso(s as IsoDate)
  return !Number.isNaN(+d) && d.getFullYear() === Number(s.slice(0, 4)) && d.getMonth() + 1 === Number(s.slice(5, 7))
}

/** Whole day of month 1–31, or null. */
export function parseDay(text: string): number | null {
  if (!/^\d{1,2}$/.test(text.trim())) return null
  const n = Number(text.trim())
  return n >= 1 && n <= 31 ? n : null
}

/** Whole installment or repeat count 1–600, or null. */
export function parseCount(text: string): number | null {
  if (!/^\d{1,3}$/.test(text.trim())) return null
  const n = Number(text.trim())
  return n >= 1 && n <= MAX_COUNT ? n : null
}

export function validateDraft(d: RecurringDraft): RecurringErrors {
  const e: RecurringErrors = {}
  if (d.name.trim() === '') e.name = 'Ad yaz, örneğin Netflix.'
  if (d.amount === null) e.amount = 'Tutarı yaz, örneğin 250.'
  else if (d.amount <= 0) e.amount = 'Tutar sıfırdan büyük olmalı.'
  if (d.accountId === null) e.account = 'Önce bir kart ya da hesap ekle.'
  if (d.categoryId === null) e.category = 'Bir kategori seç.'
  if (parseDay(d.dayText) === null) e.day = 'Ayın 1 ile 31 arasında bir gün yaz.'
  if (!isIsoDate(d.startDate)) e.startDate = 'Başlangıç tarihini seç.'
  if (d.endKind === 'until') {
    if (!isIsoDate(d.untilDate)) e.until = 'Bitiş tarihini seç.'
    else if (isIsoDate(d.startDate) && d.untilDate < d.startDate) e.until = 'Bitiş tarihi başlangıçtan sonra olmalı.'
  }
  if (d.endKind === 'count' && parseCount(d.countText) === null) e.count = `1 ile ${MAX_COUNT} arasında bir sayı yaz.`
  return e
}

export function hasErrors(e: RecurringErrors): boolean {
  return Object.values(e).some(Boolean)
}

function endOf(d: RecurringDraft): RecurrenceEnd {
  if (d.endKind === 'until') return { type: 'until', date: d.untilDate as IsoDate }
  if (d.endKind === 'count') return { type: 'count', count: parseCount(d.countText) ?? 1 }
  return { type: 'never' }
}

/** The stored payment for a valid draft; null while the draft is invalid. */
export function buildRecurring(
  d: RecurringDraft,
  base: Pick<RecurringPayment, 'id' | 'createdAt' | 'handledThrough'>,
): RecurringPayment | null {
  if (hasErrors(validateDraft(d)) || d.amount === null || d.accountId === null || d.categoryId === null) return null
  return {
    id: base.id,
    name: d.name.trim(),
    amount: d.amount,
    categoryId: d.categoryId,
    accountId: d.accountId,
    dayOfMonth: parseDay(d.dayText) ?? 1,
    startDate: d.startDate as IsoDate,
    end: endOf(d),
    active: d.active,
    handledThrough: base.handledThrough ?? null,
    createdAt: base.createdAt,
  }
}

/** "Sonraki: 12 Ekim · ayda 199 ₺", or a note when nothing is left to charge. */
export function previewLine(p: RecurringPayment, today: Date): string {
  const next = nextOccurrence(p, today)
  if (!next) return 'Bu düzenli ödeme artık tekrarlanmıyor'
  return `Sonraki: ${formatLong(next)} · ayda ${formatTL(p.amount)}`
}
