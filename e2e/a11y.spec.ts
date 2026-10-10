import { expect, expectNoA11yViolations, ROUTES, startWithDemo, test } from './fixtures'

test.describe('accessibility (axe, WCAG 2.1 AA)', () => {
  test('first launch', async ({ page }) => {
    await page.goto('./')
    await expect(page.getByRole('heading', { name: 'Cüzdanını kuralım' })).toBeVisible()
    await expectNoA11yViolations(page, 'ilk açılış')
  })

  test('every page with sample data', async ({ page }) => {
    await startWithDemo(page)
    for (const [name, hash] of Object.entries(ROUTES)) {
      await page.goto(`./${hash}`)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expectNoA11yViolations(page, name)
    }
  })

  test('sheets', async ({ page }) => {
    await startWithDemo(page)
    await page.getByRole('navigation', { name: 'Ana menü' }).getByRole('button', { name: 'Harcama ekle' }).click()
    await expect(page.getByRole('dialog', { name: 'Harcama ekle' })).toBeVisible()
    await expectNoA11yViolations(page, 'harcama ekle')
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: 'Kart veya hesap ekle' }).click()
    await expect(page.getByRole('dialog', { name: 'Hesap ekle' })).toBeVisible()
    await expectNoA11yViolations(page, 'hesap ekle')
    await page.keyboard.press('Escape')

    await page.goto('./#/takvim')
    await page.getByRole('button', { name: /^Bonus son ödeme/ }).click()
    await expect(page.getByRole('dialog', { name: 'Kredi kartı' })).toBeVisible()
    await expectNoA11yViolations(page, 'kart ayrıntısı')
    await page.getByRole('button', { name: /^Bonus Kart Kesim/ }).click()
    await expect(page.getByRole('dialog', { name: 'Bonus · Bonus Kart' })).toBeVisible()
    await expectNoA11yViolations(page, 'ekstre')
  })
})

test('applies the chosen theme from the first frame and switches it in Ayarlar', async ({ page, theme }) => {
  await page.goto('./')
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
  const ground = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  const before = await ground()

  await page.goto('./#/ayarlar')
  const other = theme === 'dark' ? 'Açık' : 'Koyu'
  await page.getByRole('radio', { name: other }).check()
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme === 'dark' ? 'light' : 'dark')
  expect(await ground()).not.toBe(before)

  // Remembered after a reload.
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme === 'dark' ? 'light' : 'dark')
})
