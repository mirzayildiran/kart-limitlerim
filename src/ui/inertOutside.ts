/**
 * Makes everything outside an open sheet inert, up to the app root, so VoiceOver and
 * Tab cannot reach the page behind it. Only elements this call made inert are released,
 * so nested sheets and the lock screen's own inert on #app are left as they were.
 */

export interface InertNode {
  inert: boolean
  parentElement: InertNode | null
  children: ArrayLike<InertNode>
}

export function inertOutside(el: InertNode, root: InertNode): () => void {
  const changed: InertNode[] = []
  let node: InertNode | null = el
  while (node && node !== root && node.parentElement) {
    const parent: InertNode = node.parentElement
    for (const sibling of Array.from(parent.children)) {
      if (sibling !== node && !sibling.inert) {
        sibling.inert = true
        changed.push(sibling)
      }
    }
    node = parent
  }
  return () => {
    for (const n of changed) n.inert = false
  }
}
