import { useEffect } from 'preact/hooks'
import { Button } from '../../ui/components/controls'
import { locked, shielded, unlock } from '../../platform/lock'
import './lock-screen.css'

/** Covers the app while it is locked (Face ID) or inactive (app switcher snapshot). */
export function LockScreen() {
  const isLocked = locked.value
  const covered = isLocked || shielded.value

  useEffect(() => {
    // Keep VoiceOver and keyboard focus out of the hidden content.
    document.getElementById('app')?.toggleAttribute('inert', covered)
  }, [covered])

  if (!covered) return null

  return (
    <div class="lock-screen" role={isLocked ? 'dialog' : undefined} aria-modal={isLocked ? 'true' : undefined} aria-labelledby="lock-title">
      <p class="lock-title" id="lock-title">
        Kart Limitlerim
      </p>
      {isLocked && (
        <>
          <p class="lock-caption">Kilitli</p>
          <Button variant="primary" onClick={() => unlock()}>
            Kilidi aç
          </Button>
        </>
      )}
    </div>
  )
}
