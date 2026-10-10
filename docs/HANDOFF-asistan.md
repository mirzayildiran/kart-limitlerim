# Devir notu: asistan oturumu

Tarih: 2026-10-10. Dal: `claude/budget-assistant` (worktree `../kl-worktrees/asistan`). Son commit: a8a572b. Kapı yeşil (692 test).

## Biten
- Worker: Groq modeli güncellendi, iOS ve yerel ağ kaynakları kabul ediliyor (`capacitor://localhost`, `LAN_DEV_PORT`), sağlayıcı süre bütçesi 12/25 sn, OpenRouter ücretsiz model listesi, 403 → `not_configured`.
- App Store paketi: `public/privacy.html`, `public/support.html`, `docs/APP_STORE.md`.
- Yapılacaklar 2/3/4: uygulama içi gizlilik bağlantıları (Ayarlar ve onay ekranı), onay ekranı servis notları, boş ana ekranda "Örnek verilerle dene" (`src/data/demo.ts`; örnek veri `src/data/demo-backup.json`'a taşındı, `scripts/shots.mjs` oradan okuyor).

## Kalan (başka oturumlarda)
- `docs/APP_STORE.md` Yapılacaklar 1, 5, 6, 7, 8: `ios:build` sohbet adresi, `PrivacyInfo.xcprivacy`, yalnızca iPhone, mağaza boyutunda ekran görüntüleri, App Store Connect'te 18+ ve yalnızca Türkiye.
- Entegratör: `claude/budget-assistant`'ı main'e almalı (765f849 dahil); Worker'ı main'deki deploy.yml kurar, elle kurulum yok.
- iOS'ta gizlilik bağlantısının (`target="_blank"`) Safari'de açıldığı cihazda doğrulanmalı.
- Kullanıcı Cloudflare, Gemini ve Groq anahtarlarını yenilemeli; yeni değerler `gh secret set` ile girilir.

## Sıradaki adım
Koordinatörden yeni iş. Asistan arka ucunda açık bir madde yok.
