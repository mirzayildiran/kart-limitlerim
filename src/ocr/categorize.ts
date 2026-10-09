import type { Category, MerchantRule } from '../domain/types'

/** Owned by the "ocr-parser" task. Pick a category id for an imported row. */
export function suggestCategory(
  _description: string,
  _bankCategory: string | null | undefined,
  _rules: MerchantRule[],
  _categories: Category[],
): string {
  return 'diger'
}

/** Owned by the "ocr-parser" task. Normalised merchant key used for learned rules, e.g. "MONEYPAY/YEMEK" → "moneypay yemek". */
export function merchantKey(_description: string): string {
  return ''
}
