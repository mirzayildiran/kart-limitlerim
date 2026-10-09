// Console-only check of the OCR model on sample screenshots, run in Node (not part of tests or CI).
// Usage: node scripts/ocr-smoke.mjs [sampleDir]   (default: legacy/ocr-samples)
// Prints one line per OCR text line: word text with rounded [x0,y0,x1,y1] in image pixels.
// Mirrors the browser engine's second pass (src/ocr/engine.ts + src/ocr/merge.ts): when at least
// 3 amount-like words are found, the left date column is re-read and the words it adds are printed.
// Nothing is written to disk. Node has no canvas, so these images are not preprocessed (no invert,
// no upscale): results are a lower bound compared with the browser pipeline in src/ocr/preprocess.ts.
import { existsSync } from 'node:fs'
import { readFile, readdir } from 'node:fs/promises'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWorker, OEM, PSM } from 'tesseract.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sampleDir = process.argv[2] ?? join(root, 'legacy/ocr-samples')
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp'])

if (!existsSync(sampleDir)) {
  console.log(`Örnek klasörü yok: ${sampleDir}. Atlanıyor.`)
  process.exit(0)
}

const images = (await readdir(sampleDir)).filter((name) => IMAGE_EXT.has(extname(name).toLowerCase())).sort()
if (images.length === 0) {
  console.log(`Görsel yok: ${sampleDir}`)
  process.exit(0)
}

// Same language data as the browser build, read from the local package instead of the public folder.
const worker = await createWorker('tur', OEM.LSTM_ONLY, {
  langPath: join(root, 'node_modules/@tesseract.js-data/tur/4.0.0_best_int'),
  cacheMethod: 'none',
})
await worker.setParameters({
  tessedit_pageseg_mode: PSM.SPARSE_TEXT,
  preserve_interword_spaces: '1',
})

// --- Mirror of src/ocr/merge.ts (keep in sync) ---
const DATE_COLUMN_SHARE = 0.17
const DATE_WHITELIST = '0123456789:/.ABCDEFGHIİJKLMNOÖPRSŞTUÜVYZabcçdefgğhıijklmnoöprsştuüvyz'
const MIN_AMOUNTS_FOR_SECOND_PASS = 3
const MERGE_IOU = 0.3
const AMOUNT_PATTERN = /\d+[.,]\d{2}/
const iou = (a, b) => {
  const ix = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0))
  const iy = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0))
  const inter = ix * iy
  const union = Math.max(0, a.x1 - a.x0) * Math.max(0, a.y1 - a.y0) + Math.max(0, b.x1 - b.x0) * Math.max(0, b.y1 - b.y0) - inter
  return union > 0 ? inter / union : 0
}
// ---------------------------------------------------

// Image size from the PNG or JPEG header (no image library needed).
function imageSize(buf) {
  if (buf.readUInt32BE(0) === 0x89504e47) return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
  let i = 2
  while (i < buf.length) {
    const marker = buf[i + 1]
    const len = buf.readUInt16BE(i + 2)
    if (marker >= 0xc0 && marker <= 0xc2) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) }
    i += 2 + len
  }
  throw new Error('Görüntü boyutu okunamadı')
}

const r = (n) => Math.round(n)
const fmt = (w) => `${w.text} [${r(w.bbox.x0)},${r(w.bbox.y0)},${r(w.bbox.x1)},${r(w.bbox.y1)}]`
const toWords = (data) =>
  (data.blocks ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words)))
    .filter((w) => w.text.trim())
    .map((w) => ({ text: w.text.trim(), bbox: w.bbox }))
for (const name of images) {
  const { data } = await worker.recognize(join(sampleDir, name), {}, { blocks: true })
  console.log(`== ${name} (${data.blocks ? 'blocks' : 'no blocks'})`)
  for (const block of data.blocks ?? []) {
    for (const paragraph of block.paragraphs) {
      for (const line of paragraph.lines) {
        const words = line.words.filter((w) => w.text.trim()).map(fmt)
        if (words.length) console.log(words.join('  '))
      }
    }
  }

  // Second pass, same rules as the browser engine: only when amounts were found.
  const first = toWords(data)
  const amounts = first.filter((w) => AMOUNT_PATTERN.test(w.text)).length
  if (amounts >= MIN_AMOUNTS_FOR_SECOND_PASS) {
    const size = imageSize(await readFile(join(sampleDir, name)))
    const rectangle = { left: 0, top: 0, width: Math.round(DATE_COLUMN_SHARE * size.width), height: size.height }
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, tessedit_char_whitelist: DATE_WHITELIST })
    let dateData
    try {
      ;({ data: dateData } = await worker.recognize(join(sampleDir, name), { rectangle }, { blocks: true }))
    } finally {
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, tessedit_char_whitelist: '' })
    }
    const added = toWords(dateData).filter((e) => first.every((p) => iou(p.bbox, e.bbox) <= MERGE_IOU))
    console.log(`-- date column pass (${rectangle.width}px strip), added:`)
    console.log(added.length ? added.map(fmt).join('  ') : '(none)')
  }
}

await worker.terminate()
