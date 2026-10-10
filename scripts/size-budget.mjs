// First-load size budget: the JS and CSS that dist/index.html loads before the app can paint
// (entry script, modulepreloads, stylesheets), gzipped. Lazy chunks and OCR files are not counted.
// Usage: npm run build && node scripts/size-budget.mjs
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

/** Budget in KB (1024 bytes), gzip level 9. Measured 2026-10-10: JS 37.5 KB, CSS 9.4 KB. */
const BUDGET = { js: 40, css: 12 }

const dist = join(import.meta.dirname, '..', 'dist')
const html = await readFile(join(dist, 'index.html'), 'utf8')
const base = (html.match(/<script[^>]+src="([^"]*?)assets\//) ?? [])[1] ?? '/'
const refs = [...html.matchAll(/(?:src|href)="([^"]+\.(js|css))"/g)].map((m) => ({ path: m[1].slice(base.length), type: m[2] }))

const totals = { js: 0, css: 0 }
for (const { path, type } of refs) {
  const size = gzipSync(await readFile(join(dist, path)), { level: 9 }).length
  totals[type] += size
  console.log(`${(size / 1024).toFixed(1).padStart(6)} KB  ${path}`)
}

let failed = false
for (const type of /** @type {const} */ (['js', 'css'])) {
  const kb = totals[type] / 1024
  const ok = kb <= BUDGET[type]
  failed ||= !ok
  console.log(`${ok ? 'ok  ' : 'AŞTI'} ilk ${type.toUpperCase()} gzip ${kb.toFixed(1)} KB / ${BUDGET[type]} KB`)
}
if (refs.length === 0) {
  console.error('dist/index.html içinde JS ya da CSS bulunamadı.')
  failed = true
}
process.exit(failed ? 1 : 0)
