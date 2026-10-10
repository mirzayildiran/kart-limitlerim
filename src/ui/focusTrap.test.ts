import { describe, it, expect } from 'vitest'
import { trapTarget } from './focusTrap'

// trapTarget only compares identities, so plain objects stand in for elements.
const el = (name: string) => ({ name }) as unknown as HTMLElement
const [a, b, c] = [el('a'), el('b'), el('c')]
const items = [a, b, c]

describe('trapTarget', () => {
  it('wraps Tab from the last control to the first', () => {
    expect(trapTarget(items, c, false)).toBe(a)
  })

  it('wraps Shift+Tab from the first control to the last', () => {
    expect(trapTarget(items, a, true)).toBe(c)
  })

  it('lets the browser move focus between inner controls', () => {
    expect(trapTarget(items, b, false)).toBeNull()
    expect(trapTarget(items, b, true)).toBeNull()
    expect(trapTarget(items, a, false)).toBeNull()
  })

  it('pulls focus back in when it sits outside the sheet', () => {
    expect(trapTarget(items, el('outside'), false)).toBe(a)
    expect(trapTarget(items, null, true)).toBe(c)
  })

  it('does nothing when the sheet has no focusable control', () => {
    expect(trapTarget([], a, false)).toBeNull()
  })
})
