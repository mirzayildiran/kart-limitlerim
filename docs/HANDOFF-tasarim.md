# Tasarım oturumu devir notu

Son güncelleme: 2026-10-10. Çalışma klasörü: `../kl-worktrees/review` (ana klasör her zaman `main`'de kalır).

## Bitenler (hepsi push edildi, yarım iş yok)

| Dal | Son commit | İçerik |
|---|---|---|
| `design/final-review` | 9db1465 | iPhone ergonomisi: 44pt hedefler, güvenli alanlar, klavyede odaklı alan görünür, sayfa kilidi (`src/ui/scrollLock.ts`), input ≥16px ağı, iptal edilen View Transition yakalama, overscroll/user-select |
| `design/store-assets` | 737ef04 | İkon (`assets/icon.svg` → `icon-only.png` 1024 saydamsız, foreground/background), açılış ekranları 2732, App Store ekran görüntüleri 6.9" ve 6.5" (`store/screenshots/`) |
| `design/native-surfaces` | 81ae714 | Face ID kilit/kalkan ekranı gece zemininde (her iki tema), "Bu iPhone" bölümü simgeli satırlar ve kalıcı izin/kurulum notları, anahtar topuzu kontrastı |

Geçici önizleme kodu hiçbir dalda yok.

## Yeniden üretme

- İkon ve açılış: `node scripts/store-assets.mjs`
- Mağaza ekran görüntüleri: `node scripts/shots.mjs --store` (Chrome: `CHROME_PATH`, Playwright Chromium ya da macOS Chrome)
- Tasarım denetçisi: `.impeccable/mocks/**` taramadan hariç (`.impeccable/config.json`)

## Açık konular

- `platform/lock` `unlock()` sonucu döndürmüyor; kilit ekranı başarısızlığı "unlock sonrası hâlâ kilitli mi" diye anlıyor. `'cancelled' | 'failed'` dönerse mesaj netleşir (davranış değişikliği; iOS oturumu).
- Dynamic Type: WKWebView kendiliğinden uygulamıyor; `font: -apple-system-body` kararı iOS oturumunda.
- Gerçek cihazda kontrol edilmesi gerekenler: çentik/ana ekran çubuğu, pencerelerde klavye, kilit ekranı geçişi.
- Ayarlar'dan açık tema seçen kullanıcı açılışta koyu→açık geçiş görür (açılış ekranı koyu).

## Kurallar (koordinatör)

Alt ajanlar yalnızca `model: "haiku"`; kalite kapısı (tsc, lint, test, build) push öncesi; `package.json`, `vite.config.ts`, `ios/`, `src/platform/*` iOS oturumunun alanı.
