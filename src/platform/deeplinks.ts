import { effect } from '@preact/signals'
import { accounts, ready } from '../data/store'
import { go, openSheet, type Route } from '../ui/nav'
import { isNativeApp } from './files'
import { locked } from './lock'

/**
 * kartlimitlerim:// deep links. The home-screen quick actions (Info.plist) are the same URLs,
 * so both arrive through the App plugin: appUrlOpen while running, getLaunchUrl on a cold launch.
 */

type DeepLink =
  | { route: Route }
  | { sheet: 'expense' }
  /** A card line's statement, from a due-date reminder; its quick buttons mark it paid. */
  | { sheet: 'statement'; accountId: string; lineIndex: number }

const LINKS: Record<string, DeepLink> = {
  'harcama-ekle': { sheet: 'expense' },
  takvim: { route: 'calendar' },
  harcamalar: { route: 'expenses' },
  ozet: { route: 'home' },
  ayarlar: { route: 'settings' },
}

/** Maps a kartlimitlerim:// URL to where the app should go; null for anything else. */
export function parseDeepLink(url: string): DeepLink | null {
  if (url.length > 200) return null
  const statement = /^kartlimitlerim:\/\/ekstre\/([A-Za-z0-9_-]{1,64})\/(\d{1,2})\/?$/i.exec(url.trim())
  if (statement) return { sheet: 'statement', accountId: statement[1], lineIndex: Number(statement[2]) }
  const m = /^kartlimitlerim:\/\/([^/?#]+)\/?(?:[?#].*)?$/i.exec(url.trim())
  // Own keys only: "constructor" or "__proto__" must not resolve to Object.prototype members.
  const key = m?.[1].toLowerCase()
  return key !== undefined && Object.hasOwn(LINKS, key) ? LINKS[key] : null
}

/** The link a due-date reminder opens: that card line's statement. */
export function statementLink(accountId: string, lineIndex: number): string {
  return `kartlimitlerim://ekstre/${accountId}/${lineIndex}`
}

function apply(link: DeepLink) {
  if ('route' in link) return go(link.route)
  if (link.sheet === 'expense') return openSheet({ type: 'expense' })
  // The card may have been deleted or its lines changed since the reminder was scheduled.
  const account = accounts.value.find((a) => a.id === link.accountId)
  if (account?.kind === 'card' && link.lineIndex < account.lines.length) openSheet({ type: 'statement', accountId: account.id, lineIndex: link.lineIndex })
  else go('calendar')
}

/** Applies a link once data has loaded and the Face ID lock is open, so nothing opens behind the lock. */
export function handleDeepLink(url: string | undefined): void {
  if (!url) return
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
      App.addListener('appUrlOpen', ({ url }) => handleDeepLink(url))
      return App.getLaunchUrl()
    })
    .then((launch) => {
      handleDeepLink(launch?.url)
    })
    .catch(() => {})
}
