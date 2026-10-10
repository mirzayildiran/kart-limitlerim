import { readFile } from 'node:fs/promises'
import { expect, startWithDemo, test } from './fixtures'

test('exports a backup, erases everything and restores it', async ({ page }, info) => {
  await startWithDemo(page)
  const total = await page.getByRole('region', { name: 'Harcama gücün' }).getByRole('paragraph').first().textContent()

  await page.goto('./#/ayarlar')
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Yedeği indir' }).click()
  const download = await downloaded
  const file = info.outputPath('yedek.json')
  await download.saveAs(file)
  const backup = JSON.parse(await readFile(file, 'utf8'))
  expect(backup).toMatchObject({ app: 'kart-limitlerim', schema: 2 })
  expect(backup.data.accounts.length).toBeGreaterThan(0)

  // Erase: two taps on the confirm button.
  await page.getByRole('button', { name: 'Tüm verileri sil' }).click()
  await page.getByRole('button', { name: 'Geri alınamaz. Silmek için tekrar dokun' }).click()
  await page.goto('./#/')
  await expect(page.getByRole('heading', { name: 'Cüzdanını kuralım' })).toBeVisible()

  // Restore from the downloaded file.
  await page.goto('./#/ayarlar')
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Yedekten geri yükle' }).click()
  await (await chooser).setFiles(file)
  const confirm = page.getByRole('group', { name: 'Geri yükleme onayı' })
  await confirm.getByRole('button', { name: 'Geri yükle' }).click()
  await confirm.getByRole('button', { name: 'Emin misin? Tekrar dokun' }).click()
  await expect(page.getByText('Yedek geri yüklendi')).toBeVisible()

  await page.goto('./#/')
  await expect(page.getByRole('region', { name: 'Harcama gücün' }).getByRole('paragraph').first()).toHaveText(total!)
})

test('rejects a damaged backup with a clear message and keeps the data', async ({ page }, info) => {
  await startWithDemo(page)
  const file = info.outputPath('bozuk.json')
  const { writeFile } = await import('node:fs/promises')
  await writeFile(
    file,
    JSON.stringify({ app: 'kart-limitlerim', schema: 2, exportedAt: '2026-10-10T00:00:00Z', data: { accounts: [{ id: 'a', kind: 'card', name: 'X', limit: 'çok' }], expenses: [], categories: [], recurring: [], rules: [], budgets: [] } }),
  )
  await page.goto('./#/ayarlar')
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Yedekten geri yükle' }).click()
  await (await chooser).setFiles(file)
  await expect(page.getByRole('alert')).toHaveText('Yedek dosyası bozuk: 1. hesap, limit geçersiz.')
  await expect(page.getByRole('group', { name: 'Geri yükleme onayı' })).toHaveCount(0)
})
