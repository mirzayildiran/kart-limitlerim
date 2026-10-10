import { describe, it, expect } from 'vitest'
import { CONSENT_VERSION, parseConsent } from './consent'

/** Tests use invented values only. */

describe('parseConsent', () => {
  it('returns null when nothing is stored', () => {
    expect(parseConsent(null)).toBeNull()
  })

  it('accepts a stored consent for the current version', () => {
    expect(parseConsent(JSON.stringify({ v: CONSENT_VERSION, at: 1_700_000_000_000 }))).toEqual({
      v: CONSENT_VERSION,
      at: 1_700_000_000_000,
    })
  })

  it('rejects text that is not JSON', () => {
    expect(parseConsent('')).toBeNull()
    expect(parseConsent('evet')).toBeNull()
  })

  it('rejects a consent for another version', () => {
    expect(parseConsent(JSON.stringify({ v: CONSENT_VERSION + 1, at: 1 }))).toBeNull()
    expect(parseConsent(JSON.stringify({ v: 0, at: 1 }))).toBeNull()
  })

  it('rejects a version or time that is not a number', () => {
    expect(parseConsent(JSON.stringify({ v: String(CONSENT_VERSION), at: 1 }))).toBeNull()
    expect(parseConsent(JSON.stringify({ v: CONSENT_VERSION, at: '1' }))).toBeNull()
    expect(parseConsent(JSON.stringify({ v: CONSENT_VERSION }))).toBeNull()
  })

  it('rejects JSON values that are not an object', () => {
    expect(parseConsent('null')).toBeNull()
    expect(parseConsent('5')).toBeNull()
    expect(parseConsent('[1]')).toBeNull()
    expect(parseConsent('"yes"')).toBeNull()
  })
})
