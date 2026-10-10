import { effect } from '@preact/signals'
import { ready } from '../data/store'
import { go, openSheet, type Route } from '../ui/nav'
import { isNativeApp } from './files'
import { locked } from './lock'

/**
 * kartlimitlerim:// deep links. The home-screen quick actions (Info.plist) are the same URLs,
 * so both arrive through the App plugin: appUrlOpen while running, getLaunchUrl on a cold launch.
 */

export type DeepLink = { route: Route } | { sheet: 'expense' }

const LINKS: Record<string, DeepLink> = {
  'harcama-ekle': { sheet: 'expense' },
  takvim: { route: 'calendar' },
  harcamalar: { route: 'expenses' },
  ozet: { route: 'home' },
  ayarlar: { route: 'settings' },
}

/** Maps a kartlimitlerim:// URL to where the app should go; null for anything else. */
export function parseDeepLink(url: string): DeepLink | null {
  const m = /^kartlimitlerim:\/\/([^/?#]+)\/?(?:[?#].*)?$/i.exec(url.trim())
  return m ? (LINKS[m[1].toLowerCase()] ?? null) : null
}

function apply(link: DeepLink) {
  if ('route' in link) go(link.route)
  else openSheet({ type: link.sheet })
}

/** Applies a link once data has loaded and the Face ID lock is open, so nothing opens behind the lock. */
function handle(url: string) {
  const link = parseDeepLink(url)
  if (!link) return
  const dispose = effect(() => {
    if (!ready.value || locked.value) return
    // Deferred: disposing inside the effect's first run is not allowed.
    queueMicrotask(() => dispose())
    apply(link)
  })
}

/** Call once at startup. */
export function startDeepLinks(): void {
  if (!isNativeApp) return
  import('@capacitor/app')
    .then(({ App }) => {
      App.addListener('appUrlOpen', ({ url }) => handle(url))
      return App.getLaunchUrl()
    })
    .then((launch) => {
      if (launch?.url) handle(launch.url)
    })
    .catch(() => {})
}
