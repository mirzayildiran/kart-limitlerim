import { isNativeApp } from './files'

/**
 * Dynamic Type for the iOS app. WKWebView does not follow the system text size by itself, but it
 * resolves `font: -apple-system-body` to it (17px at the default setting). The app's type scale is
 * in rem on a 16px root, so the root takes the same ratio, capped so the largest accessibility
 * sizes do not break single-line layouts (figures, tab bar).
 */

const SYSTEM_DEFAULT = 17
const BASE = 16
const MIN = 14
/** 160 % of the base: the largest size the layout is checked at (design/polish-4). */
const MAX = 25.6

export function rootSizeFor(systemBodyPx: number): number {
  if (!Number.isFinite(systemBodyPx) || systemBodyPx <= 0) return BASE
  const px = (BASE * systemBodyPx) / SYSTEM_DEFAULT
  return Math.round(Math.min(MAX, Math.max(MIN, px)) * 100) / 100
}

function systemBodyPx(): number {
  const probe = document.createElement('span')
  probe.style.cssText = 'font: -apple-system-body; position: absolute; visibility: hidden'
  document.body.appendChild(probe)
  const px = parseFloat(getComputedStyle(probe).fontSize)
  probe.remove()
  return px
}

function apply() {
  const size = rootSizeFor(systemBodyPx())
  document.documentElement.style.fontSize = size === BASE ? '' : `${size}px`
}

/** Call once at startup; re-reads the setting each time the app returns to the foreground. */
export function startTextSize(): void {
  if (!isNativeApp) return
  apply()
  import('@capacitor/app')
    .then(({ App }) => App.addListener('resume', apply))
    .catch(() => {})
}
