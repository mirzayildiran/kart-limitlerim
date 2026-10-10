// Opens the built app (dist/) in Chromium and fails on any Content-Security-Policy violation.
// Usage: npm run build && node scripts/check-csp.mjs [base]   (base: /kart-limitlerim/ for web, / for CAP_NATIVE=1)
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { chromePath } from './store-assets.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const base = process.argv[2] ?? '/kart-limitlerim/'
const PORT = 4179
const ROUTES = ['#/', '#/harcamalar', '#/takvim', '#/ayarlar', '#/asistan']

const server = spawn(join(root, 'node_modules/.bin/vite'), ['preview', '--port', String(PORT), '--strictPort', '--base', base], {
  cwd: root,
  stdio: 'ignore',
})
const url = `http://localhost:${PORT}${base}`
const violations = []
const browser = await chromium.launch({ executablePath: chromePath(), headless: true })
try {
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(url)).ok) break
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  for (const theme of ['dark', 'light']) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    page.on('console', (m) => {
      if (/Content Security Policy/i.test(m.text())) violations.push(`${theme}: ${m.text()}`)
    })
    await page.addInitScript((t) => {
      localStorage.setItem('kl:theme', t)
      document.addEventListener('securitypolicyviolation', (e) => console.error(`Content Security Policy: ${e.violatedDirective} ${e.blockedURI}`))
    }, theme)
    await page.goto(url)
    const demo = page.getByRole('button', { name: /örnek veri/i }).first()
    if (await demo.isVisible().catch(() => false)) await demo.click()
    for (const r of ROUTES) {
      await page.goto(url + r)
      await page.waitForTimeout(400)
    }
    await page.close()
  }
} finally {
  await browser.close()
  server.kill()
}
if (violations.length) {
  console.error(violations.join('\n'))
  process.exit(1)
}
console.log(`check-csp: ${base} temiz`)
