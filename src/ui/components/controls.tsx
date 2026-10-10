import type { ComponentChildren, JSX } from 'preact'
import { useEffect, useId, useState } from 'preact/hooks'
import { formatInput, parseTL } from '../../domain/money'
import type { Kurus } from '../../domain/types'
import { dismissToast, toastMsg, type ToastMsg } from './toast'
import './controls.css'

type BtnProps = JSX.HTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  block?: boolean
  type?: 'button' | 'submit'
  disabled?: boolean
}

export function Button({ variant = 'secondary', block, class: cls, type = 'button', ...rest }: BtnProps) {
  return <button type={type} class={`btn btn-${variant}${block ? ' btn-block' : ''}${cls ? ` ${cls}` : ''}`} {...rest} />
}

interface FieldProps {
  label: string
  hint?: ComponentChildren
  error?: string | null
  children: (id: string, describedBy: string | undefined) => ComponentChildren
}

/** Label + control + hint/error, wired for screen readers. */
export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId()
  const descId = hint || error ? `${id}-d` : undefined
  return (
    <div class="field">
      <label class="field-label" for={id}>
        {label}
      </label>
      {children(id, descId)}
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

interface MoneyFieldProps {
  label: string
  value: Kurus | null
  onChange: (v: Kurus | null) => void
  hint?: ComponentChildren
  error?: string | null
  placeholder?: string
  autofocus?: boolean
  /** "hero": the sheet's primary amount, display face at 2.5rem/800 (ExpenseSheet). Default: 22px. */
  size?: 'default' | 'hero'
}

/**
 * Amount input that accepts Turkish formatting ("1.234,56") and keeps the
 * user's own text while they type; the parsed value is reported upward.
 */
export function MoneyField({ label, value, onChange, hint, error, placeholder = '0', autofocus, size = 'default' }: MoneyFieldProps) {
  const [text, setText] = useState(value == null ? '' : formatInput(value))
  useEffect(() => {
    // Sync when the value is changed from outside (e.g. form reset).
    const parsed = parseTL(text)
    if (parsed !== value) setText(value == null ? '' : formatInput(value))
  }, [value])
  return (
    <Field label={label} hint={hint} error={error}>
      {(id, desc) => (
        <div class={size === 'hero' ? 'money-input money-input-hero' : 'money-input'}>
          <input
            id={id}
            class="input input-money num"
            inputMode="decimal"
            autoComplete="off"
            enterKeyHint="done"
            placeholder={placeholder}
            value={text}
            data-autofocus={autofocus ? '' : undefined}
            aria-describedby={desc}
            aria-invalid={error ? true : undefined}
            onInput={(e) => {
              const t = e.currentTarget.value
              setText(t)
              onChange(t.trim() === '' ? null : parseTL(t))
            }}
          />
          <span class="money-suffix" aria-hidden="true">
            ₺
          </span>
        </div>
      )}
    </Field>
  )
}

interface TextFieldProps {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  hint?: ComponentChildren
  error?: string | null
  type?: 'text' | 'date' | 'number'
  min?: number
  max?: number
  inputMode?: 'text' | 'numeric' | 'decimal'
}

export function TextField({ label, value, onChange, placeholder, hint, error, type = 'text', min, max, inputMode }: TextFieldProps) {
  return (
    <Field label={label} hint={hint} error={error}>
      {(id, desc) => (
        <input
          id={id}
          class="input"
          type={type}
          min={min}
          max={max}
          inputMode={inputMode}
          placeholder={placeholder}
          value={value}
          aria-describedby={desc}
          aria-invalid={error ? true : undefined}
          onInput={(e) => onChange(e.currentTarget.value)}
        />
      )}
    </Field>
  )
}

interface SwitchProps {
  label: ComponentChildren
  checked: boolean
  onChange: (v: boolean) => void
  hint?: ComponentChildren
}

export function Switch({ label, checked, onChange, hint }: SwitchProps) {
  const id = useId()
  return (
    <div class="switch-row">
      <label class="switch" for={id}>
        <span class="switch-text">
          <span>{label}</span>
          {hint && <span class="field-hint">{hint}</span>}
        </span>
        <input id={id} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.currentTarget.checked)} />
      </label>
    </div>
  )
}

interface ChoiceOption<T extends string> {
  value: T
  label: ComponentChildren
  /** Accessible name when label is rich content. */
  name?: string
  style?: JSX.CSSProperties
}

interface ChoiceProps<T extends string> {
  legend: string
  options: ChoiceOption<T>[]
  value: T | null
  onChange: (v: T) => void
  /** "chips" wraps; "segment" is an equal-width row of ≥44 px options whose labels never wrap (keep them short). */
  look?: 'chips' | 'segment'
  hideLegend?: boolean
}

/** Single-choice group rendered as chips or a segmented control (native radios). */
export function Choice<T extends string>({ legend, options, value, onChange, look = 'chips', hideLegend }: ChoiceProps<T>) {
  const name = useId()
  return (
    <fieldset class={`choice choice-${look}`}>
      <legend class={hideLegend ? 'sr-only' : 'field-label'}>{legend}</legend>
      <div class="choice-items">
        {options.map((o) => (
          <label class="choice-item" key={o.value} style={o.style}>
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} aria-label={o.name} />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function Pill({ tone = 'neutral', children }: { tone?: 'neutral' | 'ok' | 'warn' | 'crit' | 'accent'; children: ComponentChildren }) {
  return <span class={`pill pill-${tone}`}>{children}</span>
}

/** Two-step destructive button: first tap arms, second confirms. */
export function ConfirmButton({ label, confirmLabel, onConfirm }: { label: string; confirmLabel: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(t)
  }, [armed])
  return (
    <Button variant="danger" block class={armed ? 'is-armed' : ''} onClick={() => (armed ? onConfirm() : setArmed(true))}>
      {armed ? confirmLabel : label}
    </Button>
  )
}

/** Matches the 160ms exit in controls.css. */
const TOAST_OUT_MS = 160

export function ToastHost() {
  const t = toastMsg.value
  // The last message stays mounted for its exit after the signal clears.
  const [shown, setShown] = useState<ToastMsg | null>(null)
  useEffect(() => {
    if (t) {
      setShown(t)
      return
    }
    const id = setTimeout(() => setShown(null), TOAST_OUT_MS)
    return () => clearTimeout(id)
  }, [t])
  // A new message replaces the old one at once; a cleared one leaves with the exit class.
  const view = t ?? shown
  const leaving = t === null && shown !== null
  return (
    <div class="toast-host" aria-live="polite">
      {view && (
        <div class={leaving ? 'toast is-leaving' : 'toast'} key={view.id}>
          <span>{view.text}</span>
          {view.action && (
            <button
              type="button"
              class="toast-action"
              disabled={leaving}
              onClick={() => {
                view.action!.run()
                dismissToast()
              }}
            >
              {view.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ComponentChildren }) {
  return (
    <div class="empty">
      <p class="empty-title">{title}</p>
      {children && <div class="empty-body">{children}</div>}
    </div>
  )
}
