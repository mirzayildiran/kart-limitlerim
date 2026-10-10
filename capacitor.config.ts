import type { CapacitorConfig } from '@capacitor/cli'

// Canlı test: scripts/ios-dev.mjs bu değişkeni Mac'teki Vite sunucusunun ağ adresiyle doldurur,
// telefondaki uygulama dist yerine oradan yüklenir. Boşsa uygulama paketindeki dist kullanılır.
const devServer = process.env.CAP_SERVER_URL

const config: CapacitorConfig = {
  appId: 'com.mirzayildiran.kartlimitlerim',
  appName: 'Kart Limitlerim',
  webDir: 'dist',
  ios: {
    // Güvenli alanları CSS (env(safe-area-inset-*)) yönetir.
    contentInset: 'never',
    // Açılış ekranıyla aynı zemin; web içeriği yüklenirken beyaz flaş olmaz.
    backgroundColor: '#0a0a11',
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    Keyboard: {
      // The web view itself shrinks above the keyboard, so sheets (100dvh, footer button) stay
      // in view without per-sheet code. The form accessory bar (✓ on the amount field) stays.
      resize: 'native',
      resizeOnFullScreen: true,
    },
  },
  server: devServer ? { url: devServer, cleartext: true } : undefined,
}

export default config
