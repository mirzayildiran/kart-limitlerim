import type { ComponentChildren } from 'preact'
import { useId, useState } from 'preact/hooks'
import { Icon } from './Icon'
import './disclosure.css'

export interface DisclosureProps {
  /** Text of the toggle row, e.g. "Faiz oranı". */
  label: ComponentChildren
  children: ComponentChildren
  /** Controlled open state; leave out to let the Disclosure keep its own. */
  open?: boolean
  /** Initial state when uncontrolled. */
  defaultOpen?: boolean
  onToggle?: (open: boolean) => void
}

/**
 * Show/hide block that replaces `<details>` (which draws a second marker in some
 * browsers): a full-width 44 px button with the label and a chevron that turns 90°
 * when open, `aria-expanded` + `aria-controls`, and the content region below.
 */
export function Disclosure({ label, children, open, defaultOpen = false, onToggle }: DisclosureProps) {
  const id = useId()
  const [inner, setInner] = useState(defaultOpen)
  const isOpen = open ?? inner
  const toggle = () => {
    const next = !isOpen
    if (open === undefined) setInner(next)
    onToggle?.(next)
  }

  return (
    <div class={`disclosure${isOpen ? ' is-open' : ''}`}>
      <button type="button" class="disclosure-btn" aria-expanded={isOpen} aria-controls={`${id}-c`} onClick={toggle}>
        <span class="disclosure-label">{label}</span>
        <Icon name="chevron" size={18} class="disclosure-chevron" />
      </button>
      <div id={`${id}-c`} class="disclosure-content" hidden={!isOpen}>
        {children}
      </div>
    </div>
  )
}
