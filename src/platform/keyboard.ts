import { isNativeApp } from './files'

/**
 * The Keyboard plugin hides the form accessory bar by default. Keep it: the decimal pad on the
 * amount field has no return key, so ✓ is the way to close it, and ⌃ ⌄ step through a sheet's
 * fields. With `resize: 'native'` (capacitor.config.ts) the bar sits above the sheet's button.
 */
export function startKeyboard(): void {
  if (!isNativeApp) return
  import('@capacitor/keyboard')
    .then(({ Keyboard }) => Keyboard.setAccessoryBarVisible({ isVisible: true }))
    .catch(() => {})
}
