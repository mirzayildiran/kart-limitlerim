/** Controls Tab can reach. */
export const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Next element for Tab / Shift+Tab inside the sheet, wrapping at either end; null when
 * the browser's own move stays inside.
 */
export function trapTarget(items: HTMLElement[], active: Element | null, back: boolean): HTMLElement | null {
  if (items.length === 0) return null
  const first = items[0]
  const last = items[items.length - 1]
  const i = active ? items.indexOf(active as HTMLElement) : -1
  if (i === -1) return back ? last : first
  if (back && i === 0) return last
  if (!back && i === items.length - 1) return first
  return null
}
