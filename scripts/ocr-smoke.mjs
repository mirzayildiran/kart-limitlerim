// Console-only check of the OCR model on sample screenshots, run in Node (not part of tests or CI).
// Usage: node scripts/ocr-smoke.mjs [sampleDir]   (default: legacy/ocr-samples)
// Prints one line per OCR text line: word text with rounded [x0,y0,x1,y1] in image pixels.
// Nothing is written to disk. Node has no canvas, so these images are not preprocessed (no invert,
// no upscale): results are a lower bound compared with the browser pipeline in src/ocr/preprocess.ts.
import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
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

const r = (n) => Math.round(n)
for (const name of images) {
  const { data } = await worker.recognize(join(sampleDir, name), {}, { blocks: true })
  console.log(`== ${name} (${data.blocks ? 'blocks' : 'no blocks'})`)
  for (const block of data.blocks ?? []) {
    for (const paragraph of block.paragraphs) {
      for (const line of paragraph.lines) {
        const words = line.words
          .filter((w) => w.text.trim())
          .map((w) => `${w.text} [${r(w.bbox.x0)},${r(w.bbox.y0)},${r(w.bbox.x1)},${r(w.bbox.y1)}]`)
        if (words.length) console.log(words.join('  '))
      }
    }
  }
}

await worker.terminate()
