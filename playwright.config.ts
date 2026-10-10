import { defineConfig } from '@playwright/test'

/**
 * End-to-end tests against the built web app (npm run build first; `npm run e2e` does both).
 * iPhone-sized viewport (390×844). Chromium: CHROME_PATH when set (the cloud container and
 * scripts/shots.mjs use one), else Playwright's own (CI installs it).
 */
const PORT = 4180

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/kart-limitlerim/`,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    locale: 'tr-TR',
    timezoneId: 'Europe/Istanbul',
    reducedMotion: 'reduce',
    // The PWA's "works offline" toast would replace the toast a test checks once the service
    // worker installs; the tests are about the app, not the offline cache.
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    launchOptions: process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
  },
  projects: [
    { name: 'dark', use: { colorScheme: 'dark' } },
    { name: 'light', use: { colorScheme: 'light' } },
  ],
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/kart-limitlerim/`,
    reuseExistingServer: !process.env.CI,
  },
})
