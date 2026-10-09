import { createWorker, OEM, PSM, type LoggerMessage, type Page, type Worker as OcrWorker } from 'tesseract.js'
import { preprocessForOcr, toOriginal } from './preprocess'
import { DATE_WHITELIST, dateColumnRect, mergeWords, needsDateColumnPass } from './merge'
import type { OcrPage, OcrProgress, OcrWord } from './types'

const USER_ERROR = 'Görüntü okunamadı. Daha net bir ekran görüntüsüyle tekrar dene.'

/** Turkish model from @tesseract.js-data/tur (integer "best" LSTM variant, the smallest Turkish model). */
const LANG = 'tur'

/**
 * Tesseract assets are self-hosted in public/ocr (copied from node_modules by scripts/copy-ocr-assets.mjs),
 * so no request leaves the device. Absolute URLs matter: the core and language loaders resolve these
 * strings from inside the worker, where a relative path would point to the wrong folder.
 */
function ocrUrl(name: string): string {
  return new URL(`${import.meta.env.BASE_URL}ocr/${name}`, location.href).href
}

/** One worker for the whole app, created on first use. */
let workerPromise: Promise<OcrWorker> | null = null
/** Progress listener of the recognize call in flight (one import at a time). */
let activeListener: ((p: OcrProgress) => void) | undefined

function onWorkerLog(message: LoggerMessage): void {
  activeListener?.({
    stage: message.status === 'recognizing text' ? 'reading' : 'loading',
    progress: message.progress,
  })
}

function getWorker(): Promise<OcrWorker> {
  workerPromise ??= createWorker(LANG, OEM.LSTM_ONLY, {
    workerPath: ocrUrl('worker.min.js'),
    // A directory: tesseract.js picks the core variant (relaxed SIMD, SIMD or plain) by feature detection.
    corePath: ocrUrl(''),
    langPath: ocrUrl(''),
    cacheMethod: 'write',
    gzip: true,
    workerBlobURL: false,
    logger: onWorkerLog,
  })
    .then(async (worker) => {
      // PSM 11 (sparse text): bank lists are scattered columns of merchant names and amounts, with no
      // single text block, so AUTO (3) tends to merge columns into one line. Sparse mode reads each
      // word where it sits; the parser then groups words into rows by their y position.
      // preserve_interword_spaces keeps the gap between columns visible in the text.
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SPARSE_TEXT,
        preserve_interword_spaces: '1',
      })
      return worker
    })
    .catch((error: unknown) => {
      // Let the next call retry, e.g. after a failed asset download.
      workerPromise = null
      throw error
    })
  return workerPromise
}

function toWords(page: Page, scale: number): OcrWord[] {
  const words: OcrWord[] = []
  for (const block of page.blocks ?? []) {
    for (const paragraph of block.paragraphs) {
      for (const line of paragraph.lines) {
        for (const word of line.words) {
          const text = word.text.trim()
          if (!text) continue
          const { x0, y0, x1, y1 } = word.bbox
          words.push({
            text,
            x0: toOriginal(x0, scale),
            y0: toOriginal(y0, scale),
            x1: toOriginal(x1, scale),
            y1: toOriginal(y1, scale),
            confidence: word.confidence,
          })
        }
      }
    }
  }
  return words
}

/** Reads one screenshot on the device and returns its words in original image pixels. */
export async function recognize(image: Blob, onProgress?: (p: OcrProgress) => void): Promise<OcrPage> {
  activeListener = onProgress
  try {
    onProgress?.({ stage: 'preparing', progress: 0 })
    // Preprocessing runs first: a broken image fails before the 13 MB runtime is fetched.
    const prepared = await preprocessForOcr(image)

    onProgress?.({ stage: 'loading', progress: 0 })
    const worker = await getWorker()
    onProgress?.({ stage: 'loading', progress: 1 })

    onProgress?.({ stage: 'reading', progress: 0 })
    const { data } = await worker.recognize(prepared.canvas, {}, { blocks: true })
    let words = toWords(data, prepared.scale)

    // Second pass for the date column: large isolated day numbers are missed by PSM 11.
    // Only for statements that already show amounts, to keep the common case fast.
    if (needsDateColumnPass(words)) {
      onProgress?.({ stage: 'reading', progress: 0.9 })
      const rectangle = dateColumnRect(prepared.canvas.width, prepared.canvas.height)
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        tessedit_char_whitelist: DATE_WHITELIST,
      })
      try {
        const { data: dateData } = await worker.recognize(prepared.canvas, { rectangle }, { blocks: true })
        words = mergeWords(words, toWords(dateData, prepared.scale))
      } finally {
        // The worker is shared: always restore the main-pass settings.
        await worker.setParameters({
          tessedit_pageseg_mode: PSM.SPARSE_TEXT,
          tessedit_char_whitelist: '',
        })
      }
    }
    onProgress?.({ stage: 'done', progress: 1 })

    return {
      width: prepared.width,
      height: prepared.height,
      words,
    }
  } catch (error) {
    throw new Error(USER_ERROR, { cause: error })
  } finally {
    activeListener = undefined
  }
}

/** Free the OCR worker (call when the import sheet closes). */
export async function releaseOcr(): Promise<void> {
  const pending = workerPromise
  workerPromise = null
  if (!pending) return
  const worker = await pending.catch(() => null)
  await worker?.terminate()
}
