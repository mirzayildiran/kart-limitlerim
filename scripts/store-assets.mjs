// Renders the app icon and splash PNGs from the SVG sources in assets/.
// Usage: node scripts/store-assets.mjs
// Output (assets/): icon-only.png, icon-foreground.png, icon-background.png (1024×1024),
// splash.png, splash-dark.png (2732×2732), and .impeccable/review/icon-sizes.png to check small sizes.
// The iOS project's own icon sets are generated from these by the iOS session; this script does not touch ios/.
import { existsSync } from 'node:fs'
import { mkdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const ASSETS = join(root, 'assets')
const REVIEW = join(root, '.impeccable/review')
// Splash ground: the app opens dark by default (src/ui/theme.ts), so both splashes use the dark ground.
const GROUND = '#0a0a11'

export function chromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean)
  const found = candidates.find((p) => existsSync(p))
  if (!found) throw new Error(`Chrome bulunamadı. CHROME_PATH ile yolunu ver. Denenenler: ${candidates.join(', ')}`)
  return found
}

async function render(page, html, size, file, { transparent = false } = {}) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(
    `<!doctype html><html><body style="margin:0;background:${transparent ? 'transparent' : GROUND}">${html}</body></html>`,
  )
  await page.screenshot({ path: file, type: 'png', omitBackground: transparent })
  console.log(`  ${file.replace(root + '/', '')}`)
}

const img = (svg, px) => `<img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" width="${px}" height="${px}" style="display:block">`

async function main() {
  await mkdir(REVIEW, { recursive: true })
  const icon = await readFile(join(ASSETS, 'icon.svg'), 'utf8')
  const fg = await readFile(join(ASSETS, 'icon-foreground.svg'), 'utf8')
  const bg = await readFile(join(ASSETS, 'icon-background.svg'), 'utf8')

  const browser = await chromium.launch({ executablePath: chromePath(), headless: true })
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 })
    await render(page, img(icon, 1024), 1024, join(ASSETS, 'icon-only.png'))
    await render(page, img(fg, 1024), 1024, join(ASSETS, 'icon-foreground.png'), { transparent: true })
    await render(page, img(bg, 1024), 1024, join(ASSETS, 'icon-background.png'))

    // Splash: the mark alone (no tile), centred, on the app's opening ground.
    const splash = `<div style="width:2732px;height:2732px;display:grid;place-items:center">${img(fg, 1100)}</div>`
    await render(page, splash, 2732, join(ASSETS, 'splash.png'))
    await render(page, splash, 2732, join(ASSETS, 'splash-dark.png'))

    // Small-size check: the icon as iOS shows it (rounded mask) at 180, 120, 80, 60 and 40 px, on light and dark.
    const tile = (px) => `<div style="width:${px}px;height:${px}px;border-radius:${px * 0.225}px;overflow:hidden">${img(icon, px)}</div>`
    const row = (ground) =>
      `<div style="display:flex;gap:24px;align-items:center;padding:24px;background:${ground}">${[180, 120, 80, 60, 40].map(tile).join('')}</div>`
    await page.setViewportSize({ width: 620, height: 456 })
    await page.setContent(`<!doctype html><body style="margin:0">${row('#f2f2f7')}${row('#000')}</body>`)
    await page.screenshot({ path: join(REVIEW, 'icon-sizes.png'), type: 'png' })
    console.log('  .impeccable/review/icon-sizes.png')
  } finally {
    await browser.close()
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
