// Design-review screenshots of the built app, seeded with the demo backup.
// Usage:
//   node scripts/shots.mjs [screen...]   screens: home expenses calendar settings welcome sheet-expense sheet-account
//                                        sheet-account-edit sheet-account-new sheet-statement sheet-recurring
//                                        sheet-category sheet-import sheet-expense-filled
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
const PAGE_SCREENS = ['home', 'expenses', 'calendar', 'settings']
// Sheets are opened with the taps a user makes (role, visible text, a few classes), never by setting the hash.
const NEW_SHEETS = [
  'sheet-account-edit',
  'sheet-account-new',
  'sheet-statement',
  'sheet-recurring',
  'sheet-category',
  'sheet-import',
  'sheet-expense-filled',
]
const SHEET_SCREENS = ['sheet-expense', 'sheet-account', ...NEW_SHEETS]
const SCREENS = [...PAGE_SCREENS, 'welcome', ...SHEET_SCREENS]
// Heading each sheet shows once open. Sheets whose title depends on data (account name) are left out.
const SHEET_TITLE = {
  'sheet-expense': 'Harcama ekle',
  'sheet-expense-filled': 'Harcama ekle',
  'sheet-account-new': 'Hesap ekle',
  'sheet-recurring': 'Düzenli ödemeyi düzenle',
  'sheet-category': 'Kategoriyi düzenle',
  'sheet-import': 'Ekran görüntüsünden ekle',
}
const CLICK_TIMEOUT = 8_000
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
// Sheets that could not be opened: { screen, variant, reason }.
const skipped = []

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

/** Opens one sheet through the UI. Throws when a control is missing or the wrong sheet comes up. */
async function openScreen(page, screen) {
  const dialog = page.getByRole('dialog')
  const tap = (locator) => locator.click({ timeout: CLICK_TIMEOUT })
  const openExpense = async () => {
    await goRoute(page, ROUTES.home)
    await tap(page.getByRole('button', { name: 'Harcama ekle' }))
  }

  switch (screen) {
    case 'sheet-expense':
      await openExpense()
      break
    case 'sheet-expense-filled':
      await openExpense()
      await dialog.getByLabel('Tutar', { exact: true }).fill('1250')
      await tap(dialog.locator('.choice-item').first())
      break
    case 'sheet-import':
      await openExpense()
      await tap(dialog.getByRole('button', { name: 'Ekran görüntüsünden ekle' }))
      break
    case 'sheet-account':
      await goRoute(page, ROUTES.home)
      await tap(page.locator('.wallet-card').first())
      break
    case 'sheet-account-edit':
      await goRoute(page, ROUTES.home)
      await tap(page.locator('.wallet-card').first())
      await dialog.getByRole('button', { name: 'Düzenle', exact: true }).waitFor({ timeout: CLICK_TIMEOUT })
      await tap(dialog.getByRole('button', { name: 'Düzenle', exact: true }))
      // The detail sheet's "Düzenle" button is gone once the edit sheet has replaced it.
      await dialog.getByRole('button', { name: 'Düzenle', exact: true }).waitFor({ state: 'detached', timeout: CLICK_TIMEOUT })
      break
    case 'sheet-account-new':
      await goRoute(page, ROUTES.home)
      await tap(page.getByRole('button', { name: 'Kart veya hesap ekle' }))
      break
    case 'sheet-statement':
      await goRoute(page, ROUTES.home)
      await tap(page.locator('.home-statement-row').first())
      break
    case 'sheet-recurring':
      await goRoute(page, ROUTES.calendar)
      await tap(page.getByRole('region', { name: 'Düzenli ödemeler' }).getByRole('button', { name: /^Kira\b/ }))
      break
    case 'sheet-category':
      await goRoute(page, ROUTES.settings)
      await tap(page.getByRole('region', { name: 'Kategoriler' }).getByRole('button', { name: /^Yemek\b/ }))
      break
    default:
      throw new Error(`bilinmeyen pencere: ${screen}`)
  }

  await dialog.waitFor({ timeout: CLICK_TIMEOUT })
  if (SHEET_TITLE[screen]) {
    await dialog.getByRole('heading', { name: SHEET_TITLE[screen], exact: true }).waitFor({ timeout: CLICK_TIMEOUT })
  }
  await page.waitForTimeout(350)
}

/** Scrolls the open sheet's body to its end and shoots it, only when the body can scroll. */
async function shootSheetEnd(page, file) {
  const body = page.getByRole('dialog').locator('.sheet-body')
  const scrollable = await body.evaluate((el) => el.scrollHeight > el.clientHeight + 1)
  if (!scrollable) return
  await body.evaluate((el) => {
    el.scrollTop = el.scrollHeight
  })
  await page.waitForTimeout(150)
  await shoot(page, file)
}

/** Opens, shoots and closes one sheet. A sheet that cannot be opened is recorded and skipped. */
async function shootSheet(page, screen, width, theme) {
  const variant = `${width}-${theme}`
  try {
    await openScreen(page, screen)
    await shoot(page, `${screen}-${variant}.jpg`)
    if (NEW_SHEETS.includes(screen) && width === 360) await shootSheetEnd(page, `${screen}-${variant}-end.jpg`)
  } catch (err) {
    const reason = String(err?.message ?? err).split('\n')[0]
    skipped.push({ screen, variant, reason })
    console.log(`  açılamadı: ${screen} (${variant})`)
  }
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
}

/** One line per sheet that could not be opened, with the variants it failed in. */
function skippedLines() {
  const bySheet = new Map()
  for (const { screen, variant, reason } of skipped) {
    const entry = bySheet.get(screen) ?? { reason, variants: [] }
    entry.variants.push(variant)
    bySheet.set(screen, entry)
  }
  return [...bySheet].map(([screen, { reason, variants }]) => `açılamadı: ${screen} (${reason}; ${variants.join(', ')})`)
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

/**
 * Full-page capture with the fixed tab bar pinned to the bottom of the page. The style is
 * added only for this capture and removed right after; sheets and toasts are left alone.
 */
async function shootFullPage(page, file) {
  const handle = await page.addStyleTag({
    content: `
      .app-main { position: relative !important; }
      .tabbar { position: absolute !important; bottom: 0 !important; }
    `,
  })
  try {
    await shoot(page, file, { fullPage: true })
  } finally {
    await handle.evaluate((el) => el.remove())
  }
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
      const browserScreens = wanted.filter((s) => PAGE_SCREENS.includes(s) || SHEET_SCREENS.includes(s))
      if (browserScreens.length) {
        for (const theme of THEMES) {
          for (const width of SIZES) {
            console.log(`${width} ${theme}`)
            const { context, page } = await newPage(browser, { width, height: 780, theme, reducedMotion: 'reduce' }, `${width}-${theme}`)
            try {
              await bootApp(page, appUrl, theme, demo)
              for (const screen of browserScreens) {
                if (SHEET_SCREENS.includes(screen)) {
                  await shootSheet(page, screen, width, theme)
                } else {
                  await goRoute(page, ROUTES[screen])
                  await shoot(page, `${screen}-${width}-${theme}-fold.jpg`)
                  await shootFullPage(page, `${screen}-${width}-${theme}.jpg`)
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

  console.log('\nAçılamayan pencereler:')
  const lines = skippedLines()
  if (lines.length === 0) console.log('  yok')
  else for (const line of lines) console.log(`  ${line}`)
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
