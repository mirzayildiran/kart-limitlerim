import { formatNumberTL, formatNumberTLExact, spokenFigure, spokenTL } from '../../domain/money'
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

/**
 * Digits stay tabular, but the display face's tabular "." and "," are as wide
 * as a digit; set separators proportionally so "62.120" does not read as two numbers.
 * The split pieces are hidden from screen readers, which get the whole figure as one phrase.
 */
export function figure(text: string) {
  return (
    <>
      <span aria-hidden="true">
        {text.split(/([.,])/).map((part, i) => (i % 2 ? <span key={i} class="amount-sep">{part}</span> : part))}
      </span>
      <span class="sr-only">{spokenFigure(text)}</span>
    </>
  )
}

const SIGN_GLYPH = { minus: '−', plus: '+' } as const

/**
 * Money figure for big display spots. The number uses the display font; the ₺
 * is set in the body font, because the display font's ₺ glyph reads as £.
 * Screen readers get one phrase ("eksi 1.234 lira") instead of the split digits and glyphs.
 */
export function Amount({ value, exact = false, size = 'lg', tone = 'default', sign = null }: Props) {
  const format = exact ? formatNumberTLExact : formatNumberTL
  const number = sign ? `${SIGN_GLYPH[sign]}${format(Math.abs(value))}` : format(value)
  return (
    <span class={`amount amount-${size} amount-${tone} num`}>
      <span class="amount-num" aria-hidden="true">
        {figure(number)}
      </span>{' '}
      <span class="amount-cur" aria-hidden="true">
        ₺
      </span>
      <span class="sr-only">{spokenTL(value, { exact, sign })}</span>
    </span>
  )
}
