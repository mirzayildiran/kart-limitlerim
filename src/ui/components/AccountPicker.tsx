import type { ComponentChildren } from 'preact'
import { useEffect, useId, useRef, useState } from 'preact/hooks'
import { formatTL } from '../../domain/money'
import type { Account, Kurus } from '../../domain/types'
import { Icon } from './Icon'
import { rovingRadioKey } from './roving'
import './account-picker.css'

/** What an account can still spend: free limit for cards and KMH, balance for bank and cash. */
export function accountFree(a: Account): Kurus {
  return a.kind === 'card' || a.kind === 'kmh' ? a.available : a.balance
}

export interface AccountPickerProps {
  /** Visible label above the row, e.g. "Nereden ödedin?". */
  label: string
  /** Accounts in display order (callers usually pass cards, then KMH, then liquid). */
  accounts: Account[]
  /** Wallet colour slot per account id: pass `accountColors(accounts.value)` (ui/accountColor.ts) over ALL accounts. */
  colors: Map<string, number>
  value: string | null
  onChange: (id: string) => void
  /** Shown under the row in rose; replaces the hint. */
  error?: string | null
  hint?: ComponentChildren
}

/**
 * Account choice that speaks the wallet's language (Owned Colour Rule): a snap-scrolling
 * row of chips, each with a small card-shaped swatch in its wallet colour; the selected
 * chip fills with that colour, takes its ink and shows a check.
 * Semantics: role="radiogroup" with role="radio" chips, roving tabindex, arrow keys move
 * the selection. Shared by ExpenseSheet, RecurringSheet and ImportSheet.
 */
export function AccountPicker({ label, accounts, colors, value, onChange, error, hint }: AccountPickerProps) {
  const id = useId()
  const descId = error || hint ? `${id}-d` : undefined
  const hasSelection = accounts.some((a) => a.id === value)
  const rail = useRef<HTMLDivElement>(null)

  // Trailing edge fade while more chips sit off to the right (the row gives no other hint).
  const [more, setMore] = useState(false)
  useEffect(() => {
    const el = rail.current
    if (!el) return
    const update = () => setMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
    update()
    el.addEventListener('scroll', update, { passive: true })
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    ro?.observe(el)
    return () => {
      el.removeEventListener('scroll', update)
      ro?.disconnect()
    }
  }, [accounts.length])

  // Keep the chosen account in view: an edited expense may point at the sixth card.
  useEffect(() => {
    const el = rail.current?.querySelector<HTMLElement>('[aria-checked="true"]')
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [value])

  return (
    <div class="account-picker">
      <span class="field-label" id={`${id}-l`}>
        {label}
      </span>
      <div
        class={more ? 'account-picker-rail has-more' : 'account-picker-rail'}
        ref={rail}
        role="radiogroup"
        aria-labelledby={`${id}-l`}
        aria-describedby={descId}
        aria-invalid={error ? true : undefined}
        onKeyDown={(e) => {
          const i = rovingRadioKey(e, e.currentTarget)
          if (i !== null && accounts[i]) onChange(accounts[i].id)
        }}
      >
        {accounts.map((a, i) => {
          const on = a.id === value
          const free = accountFree(a)
          const hasLimit = a.kind === 'card' || a.kind === 'kmh'
          return (
            <button
              key={a.id}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`${a.name}, ${formatTL(free)} ${hasLimit ? 'kullanılabilir' : 'bakiye'}`}
              tabIndex={on || (!hasSelection && i === 0) ? 0 : -1}
              class={`account-picker-chip${on ? ' is-selected' : ''}`}
              data-slot={colors.get(a.id) ?? 1}
              onClick={() => onChange(a.id)}
            >
              <span class="account-picker-name">
                <span class="account-picker-swatch" aria-hidden="true" />
                <span class="account-picker-name-text">{a.name}</span>
              </span>
              <span class="account-picker-free num">{formatTL(free)}</span>
              {on && <Icon name="check" size={16} class="account-picker-check" />}
            </button>
          )
        })}
      </div>
      {error ? (
        <p class="field-error" id={descId} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p class="field-hint" id={descId}>
          {hint}
        </p>
      ) : null}
    </div>
  )
}
