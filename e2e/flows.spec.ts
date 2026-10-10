import { expect, startWithDemo, test } from './fixtures'

test.describe('main flows (sample data)', () => {
  test.beforeEach(async ({ page }) => startWithDemo(page))

  test('adds an expense and finds it in Harcamalar', async ({ page }) => {
    await page.getByRole('navigation', { name: 'Ana menü' }).getByRole('button', { name: 'Harcama ekle' }).click()
    const sheet = page.getByRole('dialog', { name: 'Harcama ekle' })
    await sheet.getByRole('textbox', { name: 'Tutar' }).fill('250')
    await sheet.getByRole('radio', { name: 'Market' }).click()
    await sheet.getByRole('textbox', { name: 'Not' }).fill('E2E market')
    await sheet.getByRole('button', { name: 'Kaydet' }).click()
    await expect(sheet).toBeHidden()
    await expect(page.getByText('250 ₺ Market eklendi')).toBeVisible()

    await page.getByRole('navigation', { name: 'Ana menü' }).getByRole('button', { name: 'Harcamalar' }).click()
    await expect(page.getByRole('button', { name: /E2E market Market · World 250 lira/ })).toBeVisible()
  })

  test('adds a card and shows it in the wallet', async ({ page }) => {
    await page.getByRole('button', { name: 'Kart veya hesap ekle' }).click()
    const sheet = page.getByRole('dialog', { name: 'Hesap ekle' })
    await sheet.getByRole('textbox', { name: 'Adı', exact: true }).fill('Deneme Kart')
    await sheet.getByRole('textbox', { name: 'Banka uygulamasında görünen boş limit' }).fill('12.500')
    await sheet.getByRole('textbox', { name: 'Toplam limit' }).fill('20.000')
    await sheet.getByRole('spinbutton', { name: 'Kesim günü' }).fill('15')
    await sheet.getByRole('button', { name: 'Kaydet' }).click()
    await expect(sheet).toBeHidden()
    await expect(page.getByRole('button', { name: /^Deneme Kart, Kredi kartı, 12\.500 lira kullanılabilir, limit 20\.000 lira/ })).toBeVisible()
  })

  test('marks a statement paid from Takvim', async ({ page }) => {
    await page.getByRole('navigation', { name: 'Ana menü' }).getByRole('button', { name: 'Takvim' }).click()
    await page.getByRole('button', { name: /^Bonus son ödeme/ }).click()
    await page.getByRole('button', { name: /^Bonus Kart Kesim/ }).click()
    const statement = page.getByRole('dialog', { name: 'Bonus · Bonus Kart' })
    await statement.getByRole('button', { name: 'Tamamını ödedim' }).click()
    await expect(statement).toBeHidden()
    // The due item no longer counts as open: home lists the statement as paid.
    await page.goto('./#/')
    await expect(page.getByRole('button', { name: /^Bonus Kesim 5 Eki · son ödeme 13 Eki .*Ödendi$/ })).toBeVisible()
  })
})
