import type { OcrWord } from './types'

/**
 * Second OCR pass for the date column. PSM 11 misses large isolated day numbers stacked above
 * month names (İş Bankası list), so the left strip is re-read in single-block mode with a
 * digits-and-letters whitelist. Pure helpers only: no DOM, no Tesseract.
 */

/** Left strip of the image that holds the date column, as a share of the width. */
const DATE_COLUMN_SHARE = 0.17
/** Whitelist for the second pass: digits, date punctuation, Turkish letters. */
export const DATE_WHITELIST =
  '0123456789:/.ABCDEFGHIİJKLMNOÖPRSŞTUÜVYZabcçdefgğhıijklmnoöprsştuüvyz'
/** Second pass runs only when the first pass already found this many amount-like words. */
const MIN_AMOUNTS_FOR_SECOND_PASS = 3
/** A second-pass word is dropped when it overlaps a first-pass word above this IoU. */
const MERGE_IOU = 0.3

const AMOUNT_PATTERN = /\d+[.,]\d{2}/

interface Rect {
  left: number
  top: number
  width: number
  height: number
}

interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
}

/** Date-column rectangle in the pixel space of the image given to Tesseract. */
export function dateColumnRect(imageWidth: number, imageHeight: number): Rect {
  return { left: 0, top: 0, width: Math.round(DATE_COLUMN_SHARE * imageWidth), height: imageHeight }
}

export function countAmountWords(words: readonly Pick<OcrWord, 'text'>[]): number {
  return words.filter((w) => AMOUNT_PATTERN.test(w.text)).length
}

export function needsDateColumnPass(words: readonly Pick<OcrWord, 'text'>[]): boolean {
  return countAmountWords(words) >= MIN_AMOUNTS_FOR_SECOND_PASS
}

/** Intersection over union of two boxes; 0 when they do not overlap or have no area. */
export function iou(a: Box, b: Box): number {
  const ix = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0))
  const iy = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0))
  const inter = ix * iy
  const areaA = Math.max(0, a.x1 - a.x0) * Math.max(0, a.y1 - a.y0)
  const areaB = Math.max(0, b.x1 - b.x0) * Math.max(0, b.y1 - b.y0)
  const union = areaA + areaB - inter
  return union > 0 ? inter / union : 0
}

/**
 * Adds the extra words that do not overlap any primary word (IoU <= MERGE_IOU).
 * Result is ordered top-to-bottom, then left-to-right, so date words sit next to their row.
 */
export function mergeWords(primary: readonly OcrWord[], extra: readonly OcrWord[]): OcrWord[] {
  const added = extra.filter(
    (e) => e.text.trim() !== '' && primary.every((p) => iou(p, e) <= MERGE_IOU),
  )
  if (added.length === 0) return [...primary]
  return [...primary, ...added].sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0)
}
