/**
 * Folds text for OCR-tolerant matching: Turkish lowercasing, diacritics removed,
 * dotless ı mapped to i. "BORÇ ÖDE" and "Borc Ode" both fold to "borc ode".
 */
export function fold(s: string): string {
  return s.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/\p{M}/gu, '').replace(/ı/g, 'i')
}
