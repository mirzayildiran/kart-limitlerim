// Design-review screenshots of the built app, seeded with the demo backup.
// Usage:
//   node scripts/shots.mjs [screen...]   screens: home expenses calendar settings welcome sheet-expense sheet-account
//   node scripts/shots.mjs --motion      frames of the home -> expenses tab transition (reduced motion off)
// Output: .impeccable/review/shots/<screen>-<width>-<theme>.jpg (motion: motion-<ms>.jpg)
// Builds the app first, then uses a running preview on :4173 or starts one and stops it at the end.
import { spawn, spawnSync } from 'node:child_process'
import { mkdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(root, '.impeccable/review/shots')
const FIXTURE = join(root, 'scripts/fixtures/demo-backup.json')
const VITE = join(root, 'node_modules/.bin/vite')
// Chromium from the shared Playwright install (the folder holds chrome-linux/chrome).
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const PORT = 4173
// Mirrors DB_NAME / DB_VERSION in src/data/db.ts. Store names are the ones createObjectStore uses there.
const DB_NAME = 'kart-limitlerim'
const STORES = ['accounts', 'expenses', 'categories', 'recurring', 'rules']
// Hash routes from src/ui/nav.ts.
const ROUTES = { home: '#/', expenses: '#/harcamalar', calendar: '#/takvim', settings: '#/ayarlar' }

const SIZES = [360, 430]
const WELCOME_WIDTH = 390
const THEMES = ['dark', 'light']
const SCREENS = ['home', 'expenses', 'calendar', 'settings', 'welcome', 'sheet-expense', 'sheet-account']
const MOTION_MS = [0, 60, 120, 200, 320]

const args = process.argv.slice(2)
const motion = args.includes('--motion')
const selected = args.filter((a) => !a.startsWith('--'))
for (const s of selected) {
  if (!SCREENS.includes(s)) {
    console.error(`Bilinmeyen ekran: ${s}. Geçerli değerler: ${SCREENS.join(', ')}`)
    process.exit(1)
  }
}
const wanted = selected.length ? selected : SCREENS

const errors = []

// ---- build and preview server -------------------------------------------------

async function probe(url) {
  try {
    const res = await fetch(url)
    return res.ok
  } catch {
    return false
  }
}

async function startPreview() {
  const base = `http://localhost:${PORT}/kart-limitlerim/`
  if (await probe(base)) {
    console.log(`Çalışan önizleme kullanılıyor: ${base}`)
    return { url: base, stop: () => {} }
  }
  const build = spawnSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit' })
  if (build.status !== 0) throw new Error('npm run build başarısız.')

  const child = spawn(VITE, ['preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })
  const url = await new Promise((resolve, reject) => {
    let buf = ''
    const timer = setTimeout(() => reject(new Error('vite preview 30 sn içinde açılmadı.')), 30_000)
    const onData = (chunk) => {
      buf += chunk.toString()
      const m = buf.match(/Local:\s+(http\S+)/)
      if (m) {
        clearTimeout(timer)
        resolve(m[1])
      }
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', onData)
    child.on('exit', (code) => {
      clearTimeout(timer)
      reject(new Error(`vite preview çıktı (kod ${code}).`))
    })
  })
  return { url, stop: () => child.kill('SIGTERM') }
}

// ---- demo data ----------------------------------------------------------------

const dayNumber = (y, m, d) => Date.UTC(y, m, d) / 86_400_000
const isoOf = (y, m, d) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10)
const parseIso = (s) => s.split('-').map(Number)

/** Key of the most recent statement cut on or before `today` (same rule as src/domain/statement.ts lastCut). */
function currentCycleKey(cutDay, today) {
  const y = today.getFullYear()
  const m = today.getMonth()
  const thisCut = new Date(y, m, Math.min(cutDay, new Date(y, m + 1, 0).getDate()))
  const cut = thisCut <= today ? thisCut : new Date(y, m - 1, Math.min(cutDay, new Date(y, m, 0).getDate()))
  return `${cut.getFullYear()}-${String(cut.getMonth() + 1).padStart(2, '0')}`
}

/**
 * The fixture is written for the day in `exportedAt` (2026-10-10). Every date is moved by the
 * same number of days so the demo stays "today"-relative, card cycles are recomputed for today,
 * and exportedAt becomes now.
 */
function prepareDemo(backup, now) {
  const [by, bm, bd] = parseIso(backup.exportedAt.slice(0, 10))
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const delta = dayNumber(today.getFullYear(), today.getMonth(), today.getDate()) - dayNumber(by, bm - 1, bd)
  const shift = (s) => {
    if (!s) return s
    const [y, m, d] = parseIso(s)
    return isoOf(y, m - 1, d + delta)
  }
  const data = structuredClone(backup.data)
  data.expenses = data.expenses.map((e) => ({ ...e, date: shift(e.date) }))
  data.recurring = data.recurring.map((r) => ({
    ...r,
    startDate: shift(r.startDate),
    handledThrough: shift(r.handledThrough),
    end: r.end.type === 'until' ? { ...r.end, date: shift(r.end.date) } : r.end,
  }))
  for (const a of data.accounts) {
    if (a.kind !== 'card') continue
    a.lines = a.lines.map((l) => ({ ...l, dueDate: shift(l.dueDate), cycle: currentCycleKey(l.cutDay, today) }))
  }
  return { ...backup, exportedAt: now.toISOString(), data }
}

/** Replace the app's IndexedDB content with the demo data (same stores the app's restoreBackup uses). */
async function seed(page, data) {
  await page.evaluate(
    async ({ dbName, stores, data }) => {
      const db = await new Promise((resolve, reject) => {
        const req = indexedDB.open(dbName)
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })
      try {
        const missing = stores.filter((s) => !db.objectStoreNames.contains(s))
        if (missing.length) throw new Error(`Store yok: ${missing.join(', ')}`)
        await new Promise((resolve, reject) => {
          const tx = db.transaction(stores, 'readwrite')
          for (const s of stores) {
            const store = tx.objectStore(s)
            store.clear()
            for (const item of data[s]) store.put(item)
          }
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
          tx.onabort = () => reject(tx.error)
        })
      } finally {
        db.close()
      }
    },
    { dbName: DB_NAME, stores: STORES, data },
  )
}

// ---- page helpers -------------------------------------------------------------

async function waitApp(page) {
  await page.waitForSelector('.app-content > *', { timeout: 20_000 })
  await page.evaluate(() => document.fonts.ready)
}

async function goRoute(page, hash) {
  await page.evaluate((h) => {
    if (location.hash !== h) location.hash = h
  }, hash)
  await page.waitForFunction((h) => location.hash === h, hash)
  await page.waitForTimeout(350)
}

async function openSheet(page, screen) {
  await goRoute(page, ROUTES.home)
  if (screen === 'sheet-expense') {
    await page.getByRole('button', { name: 'Harcama ekle' }).click()
  } else {
    await page.locator('.wallet-card').first().click()
  }
  await page.getByRole('dialog').waitFor()
  await page.waitForTimeout(350)
}

function track(page, label) {
  page.on('pageerror', (e) => errors.push(`[${label}] ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`[${label}] ${m.text()}`)
  })
}

async function newPage(browser, { width, height, theme, reducedMotion }, label) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    reducedMotion,
    colorScheme: theme,
    locale: 'tr-TR',
  })
  const page = await context.newPage()
  track(page, label)
  return { context, page }
}

/** Load the app, optionally seed demo data, then set the theme in localStorage and reload. */
async function bootApp(page, appUrl, theme, demo) {
  await page.goto(appUrl, { waitUntil: 'load' })
  await waitApp(page)
  if (demo) await seed(page, demo)
  await page.evaluate((t) => localStorage.setItem('kl:theme', t), theme)
  await page.reload({ waitUntil: 'load' })
  await waitApp(page)
}

async function shoot(page, file, opts = {}) {
  await page.screenshot({ path: join(OUT, file), type: 'jpeg', quality: 80, ...opts })
  console.log(`  ${file}`)
}

// ---- main ---------------------------------------------------------------------

async function main() {
  await mkdir(OUT, { recursive: true })
  const demoRaw = JSON.parse(await readFile(FIXTURE, 'utf8'))
  const demo = prepareDemo(demoRaw, new Date()).data

  const preview = await startPreview()
  const appUrl = preview.url
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    // Chromium refuses to start its sandbox as root; this is a local screenshot run only.
    args: process.getuid?.() === 0 ? ['--no-sandbox'] : [],
  })

  try {
    if (motion) {
      await shootMotion(browser, appUrl, demo)
    } else {
      const pageScreens = wanted.filter((s) => ['home', 'expenses', 'calendar', 'settings', 'sheet-expense', 'sheet-account'].includes(s))
      if (pageScreens.length) {
        for (const theme of THEMES) {
          for (const width of SIZES) {
            console.log(`${width} ${theme}`)
            const { context, page } = await newPage(browser, { width, height: 780, theme, reducedMotion: 'reduce' }, `${width}-${theme}`)
            try {
              await bootApp(page, appUrl, theme, demo)
              for (const screen of pageScreens) {
                if (screen.startsWith('sheet-')) {
                  await openSheet(page, screen)
                  await shoot(page, `${screen}-${width}-${theme}.jpg`)
                  await page.keyboard.press('Escape')
                  await page.waitForTimeout(200)
                } else {
                  await goRoute(page, ROUTES[screen])
                  await shoot(page, `${screen}-${width}-${theme}.jpg`, { fullPage: true })
                }
              }
            } finally {
              await context.close()
            }
          }
        }
      }

      if (wanted.includes('welcome')) {
        for (const theme of THEMES) {
          console.log(`welcome ${WELCOME_WIDTH} ${theme}`)
          const { context, page } = await newPage(browser, { width: WELCOME_WIDTH, height: 844, theme, reducedMotion: 'reduce' }, `welcome-${theme}`)
          try {
            await bootApp(page, appUrl, theme, null)
            await shoot(page, `welcome-${WELCOME_WIDTH}-${theme}.jpg`, { fullPage: true })
          } finally {
            await context.close()
          }
        }
      }
    }
  } finally {
    await browser.close()
    preview.stop()
  }

  console.log('\nKonsol hataları:')
  if (errors.length === 0) console.log('  yok')
  else for (const e of errors) console.log(`  ${e}`)
}

/**
 * Frames of the home -> expenses tab switch. Frames are taken at the moment each target
 * time has passed in the page clock; the screenshot itself adds some latency, so the
 * printed actual times are the ones to read.
 */
async function shootMotion(browser, appUrl, demo) {
  const { context, page } = await newPage(browser, { width: 390, height: 844, theme: 'dark', reducedMotion: 'no-preference' }, 'motion')
  try {
    await bootApp(page, appUrl, 'dark', demo)
    await goRoute(page, ROUTES.home)
    const tab = page.locator('.tabbar').getByRole('button', { name: 'Harcamalar' })
    const t0 = await tab.evaluate((el) => {
      el.click()
      return performance.now()
    })
    for (const ms of MOTION_MS) {
      await page.waitForFunction((a) => performance.now() - a.t0 >= a.ms, { t0, ms }, { polling: 'raf' })
      const actual = await page.evaluate((t) => Math.round(performance.now() - t), t0)
      await shoot(page, `motion-${ms}.jpg`)
      console.log(`    hedef ${ms} ms, ölçülen ${actual} ms`)
    }
  } finally {
    await context.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
