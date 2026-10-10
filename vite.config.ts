/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import preact from '@preact/preset-vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves the app under /kart-limitlerim/.
// CAP_NATIVE=1: iOS app build (Capacitor). Served from the app root, no service worker.
const native = process.env.CAP_NATIVE === '1'
// The iOS app has no deploy workflow to inject the assistant proxy; the address is public.
if (native) process.env.VITE_ASSISTANT_PROXY_URL ??= 'https://kart-limitlerim-asistan.kart-limitlerim-7e48db.workers.dev'
const base = native ? '/' : (process.env.BASE_PATH ?? '/kart-limitlerim/')
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [
    preact(),
    VitePWA({
      disable: native,
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'Kart Limitlerim',
        short_name: 'Limitlerim',
        description: 'Kredi kartı ve KMH limitlerinden ne kadarını harcayabileceğini gösteren bütçe uygulaması.',
        lang: 'tr',
        dir: 'ltr',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#EDF1EE',
        theme_color: '#0D7755',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // OCR runtime (~27 MB) is too big to precache on install; it is cached on first use instead.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['**/ocr/**'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/ocr/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'ocr-assets',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'worker/**/*.test.ts'],
  },
})
