/**
 * Keyboard for a `role="radiogroup"` whose radios use a roving tabindex (only the
 * checked radio, or the first one, has tabIndex 0). Arrow keys move to the next or
 * previous radio and wrap; Home and End jump to the ends. Focus moves to the radio
 * and its index is returned so the caller selects it (selection follows focus, as
 * with native radios). Returns null for any other key.
 */
export function rovingRadioKey(e: KeyboardEvent, group: HTMLElement): number | null {
  const step: Record<string, number | 'first' | 'last'> = {
    ArrowRight: 1,
    ArrowDown: 1,
    ArrowLeft: -1,
    ArrowUp: -1,
    Home: 'first',
    End: 'last',
  }
  const move = step[e.key]
  if (move === undefined) return null
  const radios = Array.from(group.querySelectorAll<HTMLElement>('[role="radio"]'))
  if (radios.length === 0) return null
  e.preventDefault()
  const current = radios.findIndex((r) => r === document.activeElement)
  const next =
    move === 'first'
      ? 0
      : move === 'last'
        ? radios.length - 1
        : (Math.max(current, 0) + move + radios.length) % radios.length
  radios[next].focus()
  return next
}
