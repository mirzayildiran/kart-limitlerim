import type { BankProfileId, OcrPage, ParseResult } from './types'

/** Owned by the "ocr-parser" task. Guess which bank app the screenshot comes from. */
export function detectProfile(_page: OcrPage): BankProfileId {
  return 'generic'
}

/** Owned by the "ocr-parser" task. Turn OCR words into transactions. `today` resolves dates without a year. */
export function parsePage(_page: OcrPage, _today: Date, _profile?: BankProfileId): ParseResult {
  return { profile: 'generic', txns: [], skipped: [] }
}
