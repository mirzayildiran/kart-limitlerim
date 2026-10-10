import { describe, expect, it, vi } from 'vitest'
import { lockScroll, scrollLockDepth, unlockScroll } from './scrollLock'

function fakes(scrollY: number) {
  const win = { scrollY, scrollTo: vi.fn() }
  const body = { style: { position: '', top: '', left: '', right: '', width: '', overflow: 'auto' } }
  return { win, body }
}

describe('scroll lock', () => {
  it('pins the body at the current offset and restores both on unlock', () => {
    const { win, body } = fakes(420)
    lockScroll(win, body)
    expect(body.style).toMatchObject({ position: 'fixed', top: '-420px', overflow: 'hidden' })

    unlockScroll(win, body)
    expect(body.style).toEqual({ position: '', top: '', left: '', right: '', width: '', overflow: 'auto' })
    expect(win.scrollTo).toHaveBeenCalledWith({ top: 420, behavior: 'instant' })
    expect(scrollLockDepth()).toBe(0)
  })

  it('nested locks keep the first offset and release only on the last unlock', () => {
    const { win, body } = fakes(300)
    lockScroll(win, body)
    win.scrollY = 0 // a pinned body reports no scroll
    lockScroll(win, body)
    expect(scrollLockDepth()).toBe(2)

    unlockScroll(win, body)
    expect(body.style.position).toBe('fixed')
    expect(win.scrollTo).not.toHaveBeenCalled()

    unlockScroll(win, body)
    expect(body.style.position).toBe('')
    expect(win.scrollTo).toHaveBeenCalledWith({ top: 300, behavior: 'instant' })
  })

  it('an unlock without a lock does nothing', () => {
    const { win, body } = fakes(10)
    unlockScroll(win, body)
    expect(win.scrollTo).not.toHaveBeenCalled()
    expect(body.style.overflow).toBe('auto')
  })
})
