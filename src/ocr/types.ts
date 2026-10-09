import type { IsoDate, Kurus } from '../domain/types'

/**
 * Contract between the three screenshot-import parts:
 *   engine (image → OcrPage), parser (OcrPage → ParsedTxn[]), import UI.
 * Coordinates are pixels of the original image, origin top-left.
 */

export interface OcrWord {
  text: string
  x0: number
  y0: number
  x1: number
  y1: number
  /** Tesseract confidence 0–100. */
  confidence: number
}

export interface OcrPage {
  width: number
  height: number
  words: OcrWord[]
}

/** Banks whose screenshot layout the parser knows. 'generic' = best-effort fallback. */
export type BankProfileId = 'ziraat-dinamik' | 'ziraat-bankkart' | 'akbank' | 'isbank' | 'garanti' | 'generic'

export interface ParsedTxn {
  /** Null when the row had no readable date. */
  date: IsoDate | null
  /** Merchant / description text, whitespace-normalised, without amounts or dates. */
  description: string
  /** Always positive. */
  amount: Kurus
  /** 'debit' = spending; 'credit' = payment or refund (not imported as an expense by default). */
  direction: 'debit' | 'credit'
  /** Listed under a pending/provision section (e.g. İş Bankası "BEKLEMEDE"). */
  pending: boolean
  /** "3/3 taksit"-style info when the bank prints it. `total` is the original purchase amount. */
  installment?: { index: number; count: number; total?: Kurus } | null
  /** Category text printed by the bank itself (e.g. Garanti "Market"), if any. */
  bankCategory?: string | null
  /** 0–1: how sure the parser is about this row (date found, amount clean, confidence of words). */
  confidence: number
  /** The OCR text the row was built from, for the review screen. */
  raw: string
}

export interface ParseResult {
  profile: BankProfileId
  txns: ParsedTxn[]
  /** Lines the parser skipped on purpose (totals, headers, transfers), for debugging. */
  skipped: string[]
}

export interface OcrProgress {
  stage: 'loading' | 'preparing' | 'reading' | 'done'
  /** 0–1 within the current stage. */
  progress: number
}
