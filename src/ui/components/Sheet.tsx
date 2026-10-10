import type { ComponentChildren } from 'preact'
import { useEffect, useId, useRef } from 'preact/hooks'
import { sheetClosing } from '../nav'
import { Icon } from './Icon'
import './sheet.css'

interface Props {
  open: boolean
  title: string
  /** Second line under the title, e.g. which account a statement belongs to. Part of the dialog's name. */
  subtitle?: string
  onClose: () => void
  children: ComponentChildren
  /** Sticky footer (primary action). */
  footer?: ComponentChildren
}

/**
 * Bottom sheet dialog. Traps focus loosely (focus moves in on open and back to
 * the opener on close), closes on Escape and on a tap on the scrim, locks page scroll.
 * Focus on open: the element marked `data-autofocus` (a create sheet's first field),
 * otherwise the heading, so an edit sheet does not pop the keyboard.
 */
export function Sheet({ open, title, subtitle, onClose, children, footer }: Props) {
  const titleId = useId()
  const subId = `${titleId}-s`
  const panel = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const opener = useRef<Element | null>(null)

  useEffect(() => {
    if (!open) return
    opener.current = document.activeElement
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const first = panel.current?.querySelector<HTMLElement>('[data-autofocus]') ?? heading.current
    first?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !sheetClosing.value) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      ;(opener.current as HTMLElement | null)?.focus?.({ preventScroll: true })
    }
  }, [open])

  if (!open) return null
  // While the exit plays, taps and Escape do nothing: the sheet is already going away.
  const closing = sheetClosing.value
  const close = () => {
    if (!sheetClosing.value) onClose()
  }
  return (
    <div class={closing ? 'sheet-scrim is-closing' : 'sheet-scrim'} role="presentation">
      <button type="button" class="sheet-backdrop" aria-label="Kapat" tabIndex={-1} onClick={close} />
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby={subtitle ? `${titleId} ${subId}` : titleId} ref={panel}>
        <div class="sheet-grab" aria-hidden="true" />
        <header class="sheet-head">
          <div class="sheet-titles">
            <h2 id={titleId} ref={heading} tabIndex={-1}>
              {title}
            </h2>
            {subtitle && (
              <p class="sheet-subtitle" id={subId}>
                {subtitle}
              </p>
            )}
          </div>
          <button class="sheet-close" type="button" data-close onClick={close} aria-label="Kapat">
            <Icon name="close" size={20} />
          </button>
        </header>
        <div class="sheet-body">{children}</div>
        {footer && <footer class="sheet-foot">{footer}</footer>}
      </div>
    </div>
  )
}
