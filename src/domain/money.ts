import type { Kurus } from './types'

const whole = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 })
const twoDigits = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * Exact text without the sign: a zero kuruş part is dropped ("215"), any other
 * kuruş part always shows two digits ("741,50", never "741,5").
 */
function exactText(k: Kurus): string {
  return k % 100 === 0 ? whole.format(k / 100) : twoDigits.format(k / 100)
}

export function toKurus(lira: number): Kurus {
  return Math.round(lira * 100)
}

export function toLira(k: Kurus): number {
  return k / 100
}

/** "12.345" — whole lira without the ₺ sign, for big amounts drawn with their own currency glyph. */
export function formatNumberTL(k: Kurus): string {
  return whole.format(Math.round(k / 100))
}

/** "1.234,56" — keeps kuruş when present, without the ₺ sign. */
export function formatNumberTLExact(k: Kurus): string {
  return exactText(k)
}

/** "12.345 ₺" — rounded to whole lira, for summaries. */
export function formatTL(k: Kurus): string {
  return `${formatNumberTL(k)} ₺`
}

/** "1.234,56 ₺" — keeps kuruş when present (two digits), for individual amounts. */
export function formatTLExact(k: Kurus): string {
  return `${formatNumberTLExact(k)} ₺`
}

/** Number only, for prefilling inputs: 123456 → "1.234,56". Same shape as formatNumberTLExact. */
export function formatInput(k: Kurus): string {
  return exactText(k)
}

/**
 * Parse an amount the way Turkish users type and banks print it.
 * Accepts "1.234,56", "1234,56", "1234.56", "1.234", "₺1.234,56 TL", "-50".
 * Returns null when the text holds no valid amount.
 */
export function parseTL(input: string): Kurus | null {
  let s = input.replace(/\s|₺|TL|TRY/gi, '')
  if (!s) return null
  const negative = /^[-−]/.test(s)
  s = s.replace(/^[-−+]/, '')
  if (!/^[\d.,]+$/.test(s)) return null

  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  if (lastComma >= 0 && lastDot >= 0) {
    // Both present: the later one is the decimal separator.
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  } else if (lastComma >= 0) {
    s = s.split(',').length > 2 ? s.replace(/,/g, '') : s.replace(',', '.')
  } else if (lastDot >= 0) {
    // "1.234" or "12.345.678" are thousands groups; "12.5" / "12.50" are decimals.
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '')
  }

  const n = Number(s)
  if (!Number.isFinite(n)) return null
  const k = toKurus(n)
  return negative ? -k : k
}
