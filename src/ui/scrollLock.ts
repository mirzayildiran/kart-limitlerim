/**
 * Page scroll lock for open sheets. iOS ignores `overflow: hidden` on body for touch
 * scrolling, so the body is pinned with `position: fixed` at the current offset and the
 * offset is restored on unlock. Nested locks (a sheet opening another) share one lock:
 * only the first lock pins and only the last unlock releases.
 */

interface ScrollWindow {
  scrollY: number
  scrollTo(options: { top: number; behavior?: ScrollBehavior }): void
}

interface Body {
  style: Pick<CSSStyleDeclaration, 'position' | 'top' | 'left' | 'right' | 'width' | 'overflow'>
}

const KEYS = ['position', 'top', 'left', 'right', 'width', 'overflow'] as const

let depth = 0
let savedY = 0
let savedStyle: Partial<Record<(typeof KEYS)[number], string>> = {}

export function lockScroll(win: ScrollWindow = window, body: Body = document.body): void {
  if (depth++ > 0) return
  savedY = win.scrollY
  savedStyle = Object.fromEntries(KEYS.map((k) => [k, body.style[k]]))
  Object.assign(body.style, { position: 'fixed', top: `-${savedY}px`, left: '0', right: '0', width: '100%', overflow: 'hidden' })
}

export function unlockScroll(win: ScrollWindow = window, body: Body = document.body): void {
  if (depth === 0) return
  if (--depth > 0) return
  Object.assign(body.style, savedStyle)
  win.scrollTo({ top: savedY, behavior: 'instant' })
}

/** Number of active locks; for tests. */
export const scrollLockDepth = () => depth
