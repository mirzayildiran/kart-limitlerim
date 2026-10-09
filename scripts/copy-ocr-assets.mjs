// Copies the OCR runtime (Tesseract worker, wasm cores, Turkish LSTM model) into public/ocr/
// so the app never reaches a CDN at runtime. Runs before `dev` and `build` (see package.json).
import { copyFile, mkdir, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const coreDir = join(root, 'node_modules/tesseract.js-core')
const destDir = join(root, 'public/ocr')

// The engine uses OEM.LSTM_ONLY, so tesseract.js only loads the *-lstm cores, chosen by feature detection
// (relaxed SIMD > SIMD > plain). The .wasm.js files embed the wasm binary, so the raw .wasm files are not needed.
const CORE_VARIANTS = [
  'tesseract-core-relaxedsimd-lstm.wasm.js',
  'tesseract-core-simd-lstm.wasm.js',
  'tesseract-core-lstm.wasm.js',
]

const sources = [
  [join(root, 'node_modules/tesseract.js/dist/worker.min.js'), 'worker.min.js'],
  ...CORE_VARIANTS.map((name) => [join(coreDir, name), name]),
  // Integer "best" LSTM model: the smallest Turkish model shipped by @tesseract.js-data/tur.
  [join(root, 'node_modules/@tesseract.js-data/tur/4.0.0_best_int/tur.traineddata.gz'), 'tur.traineddata.gz'],
]

await mkdir(destDir, { recursive: true })
let total = 0
for (const [src, name] of sources) {
  const srcStat = await stat(src).catch(() => null)
  if (!srcStat) throw new Error(`OCR asset missing: ${src}. Run npm install.`)
  const dest = join(destDir, name)
  const destStat = await stat(dest).catch(() => null)
  if (!destStat || destStat.size !== srcStat.size) await copyFile(src, dest)
  total += srcStat.size
}
console.log(`[ocr] ${sources.length} files in public/ocr (${(total / 1048576).toFixed(1)} MB)`)
