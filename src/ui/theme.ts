import { signal } from '@preact/signals'

/** Light, dark or follow the system. Stored per device; never leaves it. */
export type ThemePref = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'kl:theme'

function loadPref(): ThemePref {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    // Storage blocked (private mode): fall back to the default theme.
  }
  return 'dark'
}

export const themePref = signal<ThemePref>(loadPref())

/** Apply the pref to <html> and keep the browser chrome colour in step with --bg. */
function apply(p: ThemePref): void {
  const root = document.documentElement
  if (p === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', p)

  const bg = getComputedStyle(root).getPropertyValue('--bg').trim()
  if (!bg) return
  // The static tags are media-scoped; drop the scope so the explicit choice wins over the OS setting.
  const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
  if (metas.length === 0) {
    const meta = document.createElement('meta')
    meta.name = 'theme-color'
    meta.content = bg
    document.head.appendChild(meta)
    return
  }
  metas.forEach((m) => {
    m.removeAttribute('media')
    m.content = bg
  })
}

export function setTheme(p: ThemePref): void {
  try {
    localStorage.setItem(STORAGE_KEY, p)
  } catch {
    // Not persisted, but the choice still applies for this session.
  }
  themePref.value = p
  apply(p)
}

/** Call once at startup (main.tsx). Nothing runs at import time. */
export function applySavedTheme(): void {
  apply(themePref.value)
}
