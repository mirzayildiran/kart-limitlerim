import type { ComponentChildren } from 'preact'
import { useEffect, useId, useRef } from 'preact/hooks'
import { sheetClosing } from '../nav'
import { lockScroll, unlockScroll } from '../scrollLock'
import { FOCUSABLE, trapTarget } from '../focusTrap'
import { inertOutside, type InertNode } from '../inertOutside'
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
 * Bottom sheet dialog. Focus moves in on open, Tab and Shift+Tab stay inside the
 * sheet, and focus returns to the opener on close. Closes on Escape and on a tap
 * on the scrim, locks page scroll.
 */
export function Sheet({ open, title, onClose, children, footer }: Props) {
  const titleId = useId()
  const panel = useRef<HTMLDivElement>(null)
  const opener = useRef<Element | null>(null)

  useEffect(() => {
    if (!open) return
    opener.current = document.activeElement
    lockScroll()
    // VoiceOver and Tab stay in the sheet: the page behind it becomes inert until it closes.
    const appRoot = document.getElementById('app')
    const scrim = panel.current?.parentElement
    const releaseInert = scrim && appRoot ? inertOutside(scrim as unknown as InertNode, appRoot as unknown as InertNode) : () => {}
    const first =
      panel.current?.querySelector<HTMLElement>('[data-autofocus]') ??
      panel.current?.querySelector<HTMLElement>('input, select, textarea, button:not([data-close])')
    first?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !sheetClosing.value) onClose()
      if (e.key === 'Tab' && panel.current) {
        // Roving radios keep their other options at tabindex -1; those are not Tab stops.
        const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.tabIndex >= 0)
        const target = trapTarget(items, document.activeElement, e.shiftKey)
        if (target) {
          e.preventDefault()
          target.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    // iOS: when the keyboard opens, the viewport shrinks after focus; bring the field back into view.
    const vv = window.visualViewport
    const keepFocusedInView = () => {
      const el = document.activeElement
      if (el instanceof HTMLElement && panel.current?.contains(el) && el.matches('input, textarea, select')) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }
    }
    vv?.addEventListener('resize', keepFocusedInView)
    return () => {
      vv?.removeEventListener('resize', keepFocusedInView)
      document.removeEventListener('keydown', onKey)
      releaseInert()
      unlockScroll()
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
      {/* Pointer-only: the header's Kapat button is the one screen readers and keyboards reach. */}
      <button type="button" class="sheet-backdrop" aria-hidden="true" tabIndex={-1} onClick={close} />
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={panel}>
        <div class="sheet-grab" aria-hidden="true" />
        <header class="sheet-head">
          <h2 id={titleId}>{title}</h2>
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
