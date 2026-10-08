import type { Category } from './types'

/** Starter categories. Users can rename, recolor, archive or add their own. */
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'yemek', name: 'Yemek', hue: 24, builtin: true, order: 0 },
  { id: 'market', name: 'Market', hue: 140, builtin: true, order: 1 },
  { id: 'ulasim', name: 'Ulaşım', hue: 205, builtin: true, order: 2 },
  { id: 'fatura', name: 'Fatura', hue: 48, builtin: true, order: 3 },
  { id: 'kira', name: 'Kira', hue: 265, builtin: true, order: 4 },
  { id: 'eglence', name: 'Eğlence', hue: 320, builtin: true, order: 5 },
  { id: 'giyim', name: 'Giyim', hue: 290, builtin: true, order: 6 },
  { id: 'saglik', name: 'Sağlık', hue: 0, builtin: true, order: 7 },
  { id: 'abonelik', name: 'Abonelik', hue: 180, builtin: true, order: 8 },
  { id: 'egitim', name: 'Eğitim', hue: 230, builtin: true, order: 9 },
  { id: 'diger', name: 'Diğer', hue: 160, builtin: true, order: 10 },
]

export const FALLBACK_CATEGORY_ID = 'diger'

/** Spread hues for new categories so they stay distinguishable. */
export function nextHue(existing: Category[]): number {
  const used = existing.map((c) => c.hue).sort((a, b) => a - b)
  if (!used.length) return 24
  let best = 0
  let bestGap = -1
  for (let i = 0; i < used.length; i++) {
    const a = used[i]
    const b = i + 1 < used.length ? used[i + 1] : used[0] + 360
    if (b - a > bestGap) {
      bestGap = b - a
      best = (a + (b - a) / 2) % 360
    }
  }
  return Math.round(best)
}
