import { describe, expect, it } from 'vitest'
import { inertOutside, type InertNode } from './inertOutside'

function node(children: InertNode[] = []): InertNode {
  const n: InertNode = { inert: false, parentElement: null, children }
  for (const c of children) c.parentElement = n
  return n
}

describe('inertOutside', () => {
  it('makes the page behind a sheet inert up to the root, and releases it', () => {
    const scrim = node()
    const host = node([scrim])
    const page = node()
    const tabbar = node()
    const root = node([page, tabbar, host])
    const body = node([root])

    const release = inertOutside(scrim, root)
    expect([page.inert, tabbar.inert]).toEqual([true, true])
    expect([scrim.inert, host.inert, root.inert, body.inert]).toEqual([false, false, false, false])

    release()
    expect([page.inert, tabbar.inert]).toEqual([false, false])
  })

  it('leaves elements that were already inert alone', () => {
    const scrim = node()
    const page = node()
    page.inert = true
    const root = node([page, scrim])
    const release = inertOutside(scrim, root)
    release()
    expect(page.inert).toBe(true)
  })

  it('a nested sheet makes the first one inert and releases only what it changed', () => {
    const first = node()
    const page = node()
    const root = node([page, first])
    const releaseFirst = inertOutside(first, root)

    // The second sheet mounts after the first one is already open.
    const second = node()
    second.parentElement = root
    root.children = [page, first, second]
    const releaseSecond = inertOutside(second, root)
    expect([page.inert, first.inert, second.inert]).toEqual([true, true, false])

    releaseSecond()
    expect([page.inert, first.inert]).toEqual([true, false])
    releaseFirst()
    expect(page.inert).toBe(false)
  })
})
