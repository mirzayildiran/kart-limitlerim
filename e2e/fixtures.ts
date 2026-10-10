import AxeBuilder from '@axe-core/playwright'
import { expect, test as base, type Page } from '@playwright/test'

/** The theme follows the project name ("dark" / "light"); the app's own setting is stored in kl:theme. */
export const test = base.extend<{ theme: 'dark' | 'light' }>({
  theme: async ({}, use, info) => {
    await use(info.project.name === 'light' ? 'light' : 'dark')
  },
  page: async ({ page, theme }, use) => {
    await page.addInitScript((t) => {
      if (!sessionStorage.getItem('kl:e2e')) {
        sessionStorage.setItem('kl:e2e', '1')
        localStorage.setItem('kl:theme', t)
      }
    }, theme)
    await use(page)
  },
})

export { expect }

export const ROUTES = { home: '#/', expenses: '#/harcamalar', calendar: '#/takvim', settings: '#/ayarlar', assistant: '#/asistan' } as const

/** Opens the app on an empty device and loads the sample data from the first-launch screen. */
export async function startWithDemo(page: Page) {
  await page.goto('./')
  await page.getByRole('button', { name: 'Örnek verilerle dene' }).click()
  await expect(page.getByRole('heading', { name: 'Harcama gücün' })).toBeVisible()
}

/** Bottom tab bar. */
export async function goTab(page: Page, name: 'Özet' | 'Harcamalar' | 'Takvim' | 'Ayarlar') {
  await page.getByRole('navigation', { name: 'Ana menü' }).getByRole('link', { name }).or(
    page.getByRole('navigation', { name: 'Ana menü' }).getByRole('button', { name }),
  ).first().click()
}

/** WCAG 2.1 AA scan of what is on screen; fails with the rule ids and targets. */
export async function expectNoA11yViolations(page: Page, label: string) {
  // Wait for entrance animations and toasts to settle so contrast is measured on final colours.
  await page.waitForTimeout(300)
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).slice(0, 5).join(' | ')}`)
  expect(summary, `${label}: axe violations`).toEqual([])
}
