import type { OcrPage, OcrProgress } from './types'

/** Owned by the "ocr-engine" task. Reads one screenshot on the device and returns words with positions. */
export async function recognize(_image: Blob, _onProgress?: (p: OcrProgress) => void): Promise<OcrPage> {
  throw new Error('OCR henüz hazır değil.')
}

/** Free the OCR worker (call when the import sheet closes). */
export async function releaseOcr(): Promise<void> {}
