import type { ComponentType } from 'preact'
import { useEffect, useState } from 'preact/hooks'

type Loader<P> = () => Promise<ComponentType<P>>

const preloads: (() => Promise<unknown>)[] = []
let preloaded = false

/**
 * A component whose code is split into its own chunk and fetched on first use.
 * Renders nothing until the chunk arrives; preloadLazy() fetches every chunk ahead of time.
 */
export function lazy<P extends object>(load: Loader<P>): ComponentType<P> {
  let loaded: ComponentType<P> | null = null
  let pending: Promise<ComponentType<P>> | null = null
  const get = () =>
    (pending ??= load().then(
      (c) => (loaded = c),
      (err: unknown) => {
        pending = null // Let a later render retry, e.g. after a network hiccup.
        throw err
      },
    ))
  preloads.push(get)

  return function Lazy(props: P) {
    const [Comp, setComp] = useState<ComponentType<P> | null>(() => loaded)
    useEffect(() => {
      if (Comp) return
      let live = true
      get()
        .then((c) => live && setComp(() => c))
        .catch(() => {})
      return () => {
        live = false
      }
    }, [Comp])
    return Comp ? <Comp {...props} /> : null
  }
}

/** Fetches every lazy chunk once the first screen is up, so later navigation stays instant. */
export function preloadLazy(): void {
  if (preloaded) return
  preloaded = true
  const run = () => preloads.forEach((p) => p().catch(() => {}))
  if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 2000 })
  else setTimeout(run, 300)
}
