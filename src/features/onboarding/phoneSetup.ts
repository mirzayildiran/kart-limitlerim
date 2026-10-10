import { effect } from '@preact/signals'
import { cards, getFlag, ready, setFlag } from '../../data/store'
import { isNativeApp } from '../../platform/files'
import { openSheet, sheet } from '../../ui/nav'

/** Meta-store flag: the reminders / Face ID offer has been shown on this device. */
export const PHONE_SETUP_FLAG = 'onboarding.phoneSetup'

export interface PromptState {
  native: boolean
  seen: boolean
  /** The device already had cards when the app opened (an existing user, not a first run). */
  hadCards: boolean
  cardCount: number
  sheetOpen: boolean
}

/** Offer once, on the phone, right after the first card of a first run, never over another sheet. */
export function shouldOfferPhoneSetup(s: PromptState): boolean {
  return s.native && !s.seen && !s.hadCards && s.cardCount > 0 && !s.sheetOpen
}

/** Watches for the first card and opens the offer once. Call once at startup; does nothing in the browser. */
export function startPhoneSetup(): void {
  if (!isNativeApp) return
  let seen: boolean | null = null
  let hadCards = false
  const stop = effect(() => {
    if (!ready.value) return
    const cardCount = cards.value.length
    const sheetOpen = sheet.value !== null
    if (seen === null) {
      seen = true // until the flag is read; nothing is offered in between
      hadCards = cardCount > 0
      getFlag(PHONE_SETUP_FLAG).then((v) => {
        seen = v
      })
      return
    }
    if (shouldOfferPhoneSetup({ native: true, seen, hadCards, cardCount, sheetOpen })) {
      seen = true
      setFlag(PHONE_SETUP_FLAG).catch(() => {})
      openSheet({ type: 'phoneSetup' })
      stop()
    }
  })
}
