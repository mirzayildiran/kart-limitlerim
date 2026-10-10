import { expect, startWithDemo, test } from './fixtures'

// The e2e build points the assistant at this origin (VITE_ASSISTANT_PROXY_URL); the Worker is never called.
const PROXY = 'https://asistan.e2e.test'

test('asks for consent before anything is sent, then chats through the proxy', async ({ page }) => {
  const bodies: Record<string, unknown>[] = []
  await page.route(`${PROXY}/**`, async (route) => {
    const req = route.request()
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    bodies.push(req.postDataJSON())
    await route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ text: 'Bu ay markete 1.591 ₺ harcadın.', provider: 'gemini' }) })
  })
  await startWithDemo(page)
  await page.goto('./#/asistan')

  const consent = page.getByRole('region', { name: 'Sohbeti açmadan önce' })
  await expect(consent).toBeVisible()
  await expect(consent.getByText('Tek tek harcamaların ve notların')).toBeVisible()
  // The full summary is there to read before agreeing.
  await consent.getByText('Gönderilecek özeti göster').click()
  await expect(consent.locator('pre')).toContainText('"accounts"')
  expect(bodies).toHaveLength(0)

  await consent.getByRole('button', { name: 'Anladım, sohbeti aç' }).click()
  await page.getByRole('textbox').fill('Bu ay markete çok mu harcadım?')
  await page.getByRole('button', { name: 'Gönder' }).click()
  await expect(page.getByText('Bu ay markete 1.591 ₺ harcadın.')).toBeVisible()

  expect(bodies).toHaveLength(1)
  const sent = JSON.stringify(bodies[0])
  expect(bodies[0]).toMatchObject({ v: 1, messages: [{ role: 'user', text: 'Bu ay markete çok mu harcadım?' }] })
  // No single expense or note leaves the device.
  for (const note of ['Öğle yemeği', 'Restoran akşam yemeği', 'Kulaklık']) expect(sent).not.toContain(note)

  // Closing the chat takes consent back; nothing more is sent.
  await page.getByRole('button', { name: 'Sohbeti kapat' }).click()
  await expect(page.getByRole('region', { name: 'Sohbeti açmadan önce' })).toBeVisible()
})

test('says so when the assistant is unavailable', async ({ page }) => {
  await page.route(`${PROXY}/**`, (route) =>
    route.request().method() === 'OPTIONS'
      ? route.fulfill({ status: 204, headers: cors })
      : route.fulfill({ status: 503, headers: { ...cors, 'content-type': 'application/json' }, body: '{"error":"unavailable"}' }),
  )
  await startWithDemo(page)
  await page.goto('./#/asistan')
  await page.getByRole('button', { name: 'Anladım, sohbeti aç' }).click()
  await page.getByRole('textbox').fill('Merhaba')
  await page.getByRole('button', { name: 'Gönder' }).click()
  await expect(page.getByRole('alert').filter({ hasText: /asistan|şu an|ulaşılamıyor|yanıt/i })).toBeVisible()
})

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
}
