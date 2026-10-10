import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

type Nav = typeof import('./nav')
type Listener = () => void

// nav.ts reads location, window and document when it is evaluated and when it routes.
// The stubs are installed once, before the module loads; each test swaps the document.
const loc = { hash: '' }
const hashListeners: Listener[] = []
const scrollTo = vi.fn()
let reducedMotion = false
let nav: Nav

function makeDocument(withTransitions: boolean) {
  const transitions: { skipTransition: ReturnType<typeof vi.fn> }[] = []
  return {
    documentElement: { dataset: {} as Record<string, string> },
    startViewTransition: withTransitions
      ? vi.fn((cb: () => Promise<void>) => {
          const t = { skipTransition: vi.fn() }
          transitions.push(t)
          void cb()
          return t
        })
      : undefined,
    transitions,
  }
}

let doc: ReturnType<typeof makeDocument>

/** Simulates the browser: set the hash, then fire hashchange. */
function navigate(hash: string) {
  loc.hash = hash
  for (const fn of hashListeners) fn()
}

beforeAll(async () => {
  vi.stubGlobal('location', loc)
  vi.stubGlobal('window', {
    addEventListener: (type: string, fn: Listener) => {
      if (type === 'hashchange') hashListeners.push(fn)
    },
    scrollTo,
    matchMedia: () => ({ matches: reducedMotion }),
  })
  vi.stubGlobal('document', makeDocument(false))
  nav = await import('./nav')
})

beforeEach(() => {
  vi.useFakeTimers()
  reducedMotion = false
  loc.hash = ''
  scrollTo.mockClear()
  doc = makeDocument(false)
  vi.stubGlobal('document', doc)
})

afterEach(() => {
  // Flush a pending sheet exit so the next test starts from a clean state.
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
  nav.sheet.value = null
  nav.sheetClosing.value = false
  nav.route.value = 'home'
})

describe('sheet exit', () => {
  it('closing with no open sheet does nothing', () => {
    nav.closeSheet()
    expect(nav.sheet.value).toBeNull()
    expect(nav.sheetClosing.value).toBe(false)
  })

  it('plays the exit for 220 ms and then unmounts the sheet', () => {
    nav.openSheet({ type: 'import' })
    nav.closeSheet()
    expect(nav.sheetClosing.value).toBe(true)
    expect(nav.sheet.value).toEqual({ type: 'import' })

    vi.advanceTimersByTime(219)
    expect(nav.sheet.value).toEqual({ type: 'import' })

    vi.advanceTimersByTime(1)
    expect(nav.sheet.value).toBeNull()
    expect(nav.sheetClosing.value).toBe(false)
  })

  it('a second close during the exit does not restart the timer', () => {
    nav.openSheet({ type: 'import' })
    nav.closeSheet()
    vi.advanceTimersByTime(200)
    nav.closeSheet()
    vi.advanceTimersByTime(20)
    expect(nav.sheet.value).toBeNull()
  })

  it('reduced motion removes the sheet at once', () => {
    reducedMotion = true
    nav.openSheet({ type: 'import' })
    nav.closeSheet()
    expect(nav.sheet.value).toBeNull()
    expect(nav.sheetClosing.value).toBe(false)
  })

  it('opening a sheet during the exit cancels the exit', () => {
    nav.openSheet({ type: 'import' })
    nav.closeSheet()
    vi.advanceTimersByTime(100)
    nav.openSheet({ type: 'category' })
    expect(nav.sheetClosing.value).toBe(false)
    expect(nav.sheet.value).toEqual({ type: 'category' })

    vi.advanceTimersByTime(500)
    expect(nav.sheet.value).toEqual({ type: 'category' })
  })
})

describe('route change', () => {
  it('without View Transitions a hash change assigns the route and scrolls to the top', () => {
    navigate('#/harcamalar')
    expect(nav.route.value).toBe('expenses')
    expect(scrollTo).toHaveBeenCalledWith({ top: 0 })
    expect(doc.documentElement.dataset.nav).toBeUndefined()
  })

  it('go() only changes the hash; the hash change does the route change', () => {
    nav.go('calendar')
    expect(loc.hash).toBe('#/takvim')
    expect(nav.route.value).toBe('home')

    navigate(loc.hash)
    expect(nav.route.value).toBe('calendar')
  })

  it('go() to the current hash only scrolls', () => {
    loc.hash = '#/harcamalar'
    nav.go('expenses')
    expect(loc.hash).toBe('#/harcamalar')
    expect(scrollTo).toHaveBeenCalledWith({ top: 0 })
  })

  it('go() closes an open sheet', () => {
    nav.openSheet({ type: 'import' })
    nav.go('settings')
    expect(nav.sheetClosing.value).toBe(true)
  })

  it('with View Transitions a move to a later tab is forward', () => {
    doc = makeDocument(true)
    vi.stubGlobal('document', doc)
    navigate('#/harcamalar')
    expect(doc.startViewTransition).toHaveBeenCalledTimes(1)
    expect(doc.documentElement.dataset.nav).toBe('forward')
    expect(nav.route.value).toBe('expenses')
  })

  it('a move to an earlier tab is back, and a new move skips the running transition', () => {
    doc = makeDocument(true)
    vi.stubGlobal('document', doc)
    navigate('#/ayarlar')
    navigate('#/takvim')
    expect(doc.documentElement.dataset.nav).toBe('back')
    expect(nav.route.value).toBe('calendar')
    expect(doc.transitions[0].skipTransition).toHaveBeenCalled()
  })

  it('the same tab does not start a transition', () => {
    doc = makeDocument(true)
    vi.stubGlobal('document', doc)
    navigate('#/')
    expect(doc.startViewTransition).not.toHaveBeenCalled()
  })
})
