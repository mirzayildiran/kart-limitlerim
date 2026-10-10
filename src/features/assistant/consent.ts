import { signal } from '@preact/signals'

/**
 * Consent to send the budget summary and chat messages to the assistant proxy.
 * Stored only on this device. Bumping CONSENT_VERSION asks everyone again.
 */

export const CONSENT_VERSION = 1
export const STORAGE_KEY = 'kl:assistant-consent'

export interface Consent {
  v: number
  /** When consent was given, epoch milliseconds. */
  at: number
}

/** Returns the stored consent only when it is valid and for the current version. */
export function parseConsent(raw: string | null): Consent | null {
  if (raw === null) return null
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null
  const rec = data as Record<string, unknown>
  if (rec.v !== CONSENT_VERSION || typeof rec.at !== 'number' || !Number.isFinite(rec.at)) return null
  return { v: rec.v, at: rec.at }
}

function readRaw(): string | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function writeRaw(value: Consent): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    // Storage blocked: consent still holds for this session; the user is asked again next visit.
  }
}

function removeRaw(): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to remove, or storage blocked.
  }
}

export const assistantConsent = signal<Consent | null>(parseConsent(readRaw()))

export function grantConsent(): void {
  const consent: Consent = { v: CONSENT_VERSION, at: Date.now() }
  writeRaw(consent)
  assistantConsent.value = consent
}

export function revokeConsent(): void {
  removeRaw()
  assistantConsent.value = null
}
