import { useEffect, useRef, useState } from 'preact/hooks'
import { Icon } from '../../ui/components/Icon'
import { locked, shielded, unlock, unlockResult } from '../../platform/lock'
import { lockMessage } from './lockMessage'
import './lock-screen.css'

/** How long the cover fades out once the app is open again; matches .lock-screen.is-leaving. */
const LEAVE_MS = 280

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** The app icon's mark: three fanned cards, the same drawing as assets/icon.svg. */
function LockMark() {
  return (
    <svg class="lock-mark" viewBox="0 0 1024 1024" aria-hidden="true">
      <g transform="translate(500 600)">
        <g transform="rotate(-30) translate(10 -60)">
          <rect class="lock-mark-back" x="-300" y="-190" width="600" height="380" rx="64" />
        </g>
        <g transform="rotate(-10) translate(10 -30)">
          <rect class="lock-mark-mid" x="-300" y="-190" width="600" height="380" rx="64" />
        </g>
        <g transform="rotate(10) translate(20 0)">
          <rect class="lock-mark-front" x="-300" y="-190" width="600" height="380" rx="64" />
          <rect class="lock-mark-chip" x="-232" y="-122" width="124" height="96" rx="22" />
          <rect class="lock-mark-bar" x="-232" y="84" width="360" height="42" rx="21" />
        </g>
      </g>
    </svg>
  )
}

/**
 * Covers the app while it is locked (Face ID) or inactive (app switcher snapshot).
 * It sits on the launch ground in both themes, so splash → lock → app reads as one surface.
 */
export function LockScreen() {
  const isLocked = locked.value
  const covered = isLocked || shielded.value
  // Stays mounted for the fade-out after the cover lifts.
  const [shown, setShown] = useState(covered)
  const [busy, setBusy] = useState(false)
  const button = useRef<HTMLButtonElement>(null)

  // The app behind is inert, so put VoiceOver and keyboard focus on the one control there is.
  useEffect(() => {
    if (isLocked) button.current?.focus({ preventScroll: true })
  }, [isLocked])

  useEffect(() => {
    // Keep VoiceOver and keyboard focus out of the hidden content.
    document.getElementById('app')?.toggleAttribute('inert', covered)
    if (covered) {
      setShown(true)
      return
    }
    const t = setTimeout(() => setShown(false), reducedMotion() ? 0 : LEAVE_MS)
    return () => clearTimeout(t)
  }, [covered])

  if (!covered && !shown) return null

  async function onUnlock() {
    setBusy(true)
    unlockResult.value = null
    await unlock()
    setBusy(false)
  }

  return (
    <div
      class={`lock-screen${covered ? '' : ' is-leaving'}`}
      role={isLocked ? 'dialog' : undefined}
      aria-modal={isLocked ? 'true' : undefined}
      aria-labelledby={isLocked ? 'lock-title' : undefined}
    >
      <LockMark />
      {isLocked && (
        <div class="lock-body">
          <h1 class="lock-title" id="lock-title">
            Kart Limitlerim
          </h1>
          <p class="lock-caption">
            <Icon name="lock" size={16} />
            Bakiyelerin kilitli
          </p>
          <button type="button" class="lock-button" ref={button} onClick={onUnlock} disabled={busy} aria-busy={busy}>
            <Icon name="faceid" size={22} />
            {busy ? 'Doğrulanıyor…' : 'Face ID ile aç'}
          </button>
          <p class="lock-error" role="alert">
            {busy ? '' : lockMessage(unlockResult.value)}
          </p>
        </div>
      )}
    </div>
  )
}
