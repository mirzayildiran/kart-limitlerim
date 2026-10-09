import type { ComponentChildren } from 'preact'
import { useEffect, useId, useRef } from 'preact/hooks'
import { Icon } from './Icon'
import './sheet.css'

interface Props {
  open: boolean
  title: string
  onClose: () => void
  children: ComponentChildren
  /** Sticky footer (primary action). */
  footer?: ComponentChildren
}

/**
 * Bottom sheet dialog. Traps focus loosely (focus moves in on open and back to
 * the opener on close), closes on Escape and on a tap on the scrim, locks page scroll.
 */
export function Sheet({ open, title, onClose, children, footer }: Props) {
  const titleId = useId()
  const panel = useRef<HTMLDivElement>(null)
  const opener = useRef<Element | null>(null)

  useEffect(() => {
    if (!open) return
    opener.current = document.activeElement
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const first =
      panel.current?.querySelector<HTMLElement>('[data-autofocus]') ??
      panel.current?.querySelector<HTMLElement>('input, select, textarea, button:not([data-close])')
    first?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      ;(opener.current as HTMLElement | null)?.focus?.({ preventScroll: true })
    }
  }, [open])

  if (!open) return null
  return (
    <div class="sheet-scrim" role="presentation">
      <button type="button" class="sheet-backdrop" aria-label="Kapat" tabIndex={-1} onClick={onClose} />
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={panel}>
        <div class="sheet-grab" aria-hidden="true" />
        <header class="sheet-head">
          <h2 id={titleId}>{title}</h2>
          <button class="sheet-close" type="button" data-close onClick={onClose} aria-label="Kapat">
            <Icon name="close" size={20} />
          </button>
        </header>
        <div class="sheet-body">{children}</div>
        {footer && <footer class="sheet-foot">{footer}</footer>}
      </div>
    </div>
  )
}
