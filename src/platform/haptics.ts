import { isNativeApp } from './files'

/**
 * A light selection tick (snapping cards, toggling a filter). The iOS app uses the
 * Taptic Engine; browsers fall back to navigator.vibrate, which only Android honours.
 */
export function tick(): void {
  if (isNativeApp) {
    import('@capacitor/haptics').then(({ Haptics }) => Haptics.selectionChanged()).catch(() => {})
    return
  }
  navigator.vibrate?.(8)
}
