import { formatNumberTL, formatNumberTLExact } from '../../domain/money'
import type { Kurus } from '../../domain/types'
import './amount.css'

interface Props {
  value: Kurus
  /** Keep kuruş ("1.234,56") instead of whole lira. */
  exact?: boolean
  size?: 'hero' | 'xl' | 'lg' | 'md'
  tone?: 'default' | 'muted' | 'crit' | 'ok'
  /** Prefix a sign for the absolute value; omit to show the value's own minus. */
  sign?: 'minus' | 'plus' | null
}

const SIGN_GLYPH = { minus: '−', plus: '+' } as const

/**
 * Money figure for big display spots. The number uses the display font; the ₺
 * is set in the body font, because the display font's ₺ glyph reads as £.
 */
export function Amount({ value, exact = false, size = 'lg', tone = 'default', sign = null }: Props) {
  const format = exact ? formatNumberTLExact : formatNumberTL
  const number = sign ? `${SIGN_GLYPH[sign]}${format(Math.abs(value))}` : format(value)
  return (
    <span class={`amount amount-${size} amount-${tone} num`}>
      <span class="amount-num">{number}</span>{' '}
      <span class="amount-cur">₺</span>
    </span>
  )
}
