import type { Category, MerchantRule } from '../domain/types'
import { FALLBACK_CATEGORY_ID } from '../domain/categories'
import { fold } from './text'

/** Tokens that carry no merchant identity (city names, country code). */
const DROP_TOKENS = new Set(['tr', 'istanbul', 'ankara', 'izmir', 'istanb'])

/** Keyword table → built-in category ids. Checked in this order. */
const KEYWORDS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['yemek', ['yemek', 'uber eats', 'yemeksepeti', 'getir', 'coffee', 'kahve', 'cafe', 'kafe', 'restoran', 'burger', 'pizza', 'starbucks', 'sbx']],
  ['market', ['migros', 'a101', 'bim', 'sok', 'carrefour', 'macro', 'file', 'kuruyemis', 'tekel', 'market']],
  ['ulasim', ['uber', 'bitaksi', 'marti', 'istanbulkart', 'ankarakart', 'opet', 'shell', 'bp', 'petrol']],
  ['giyim', ['trendyol', 'lcw', 'defacto', 'zara', 'boyner']],
  ['abonelik', ['netflix', 'spotify', 'youtube', 'apple.com', 'icloud', 'disney']],
  ['saglik', ['eczane', 'hastane']],
  ['egitim', ['kirtasiye', 'kitap', 'udemy']],
  ['fatura', ['turkcell', 'vodafone', 'turk telekom', 'enerjisa', 'igdas', 'aski']],
]

/** Normalised merchant key used for learned rules, e.g. "MONEYPAY/YEMEK" → "moneypay yemek". */
export function merchantKey(description: string): string {
  return fold(description)
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((t) => t !== '' && !/^\d+$/.test(t) && !DROP_TOKENS.has(t))
    .join(' ')
}

/** Keyword matches at a token start. Short single-word keywords must match a whole token. */
function hasKeyword(key: string, keyword: string): boolean {
  const k = merchantKey(keyword)
  const wholeToken = !k.includes(' ') && k.length <= 3
  return new RegExp(`(?:^| )${k}${wholeToken ? '(?: |$)' : ''}`).test(key)
}

/** Pick a category id for an imported row. Always returns an active category id. */
export function suggestCategory(
  description: string,
  bankCategory: string | null | undefined,
  rules: MerchantRule[],
  categories: Category[],
): string {
  const active = categories.filter((c) => !c.archived)
  const activeIds = new Set(active.map((c) => c.id))
  const key = merchantKey(description)

  if (key) {
    const learned = rules
      .filter((r) => {
        const p = merchantKey(r.pattern)
        return p !== '' && key.includes(p) && activeIds.has(r.categoryId)
      })
      .sort((a, b) => merchantKey(b.pattern).length - merchantKey(a.pattern).length || b.hits - a.hits)
    if (learned[0]) return learned[0].categoryId
  }

  if (bankCategory) {
    const wanted = fold(bankCategory).trim()
    const byName = active.find((c) => wanted !== '' && fold(c.name).trim() === wanted)
    if (byName) return byName.id
  }

  if (key) {
    const group = KEYWORDS.find(([, words]) => words.some((w) => hasKeyword(key, w)))
    if (group) return activeIds.has(group[0]) ? group[0] : FALLBACK_CATEGORY_ID
  }

  return FALLBACK_CATEGORY_ID
}
