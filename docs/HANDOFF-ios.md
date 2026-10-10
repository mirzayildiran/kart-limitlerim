# iOS devir notu (2026-10-10, ~11:00)

Onaylı duraklama (limit). Entegratör + iOS yerel özellikleri. Çalışma klasörü `../kl-worktrees/ios`
(`feat/ios`); ana klasör daima `main`'de. Bu not yalnız `handoff/ios` dalında, `main`'e girmez.

## Neredeyiz

- `main` = `feat/ios` = `3406a74`. Kapı yeşil (759 test, lint, tsc, worker tsc, web ve CAP_NATIVE derlemeleri).
- data-safety `02a86de` ALINDI ve simülatörde doğrulandı: otomatik yedek yazılıyor, IndexedDB silinince
  "Önceki verilerin bulundu" önerisi çıkıyor, geri yükleme kalıcı. 3 kopya döngüsü sınanmadı.
- Son eklenenler: hızlı eylemler + `kartlimitlerim://` bağlantıları, Dynamic Type (%160 sınır), klavye
  (`resize: native` + form çubuğu), bildirime dokununca ekstre, sürüm damgası (`npm run ios:release`),
  `scripts/ios-smoke.sh` (geçiyor), docs/IOS.md "Üyelik alınınca".
- Soğuk açılış: Release simülatörde 1,4–2,3 sn (10 sn Debug kaynaklıydı).

## Bekleyen birleştirmeler

- `design/onboarding` (`980149f`): ALMA. Impeccable onu data-safety + güncel main ile birleştiriyor
  (main.tsx / SheetHost.tsx çakışması); koordinatör hazır olunca bildirecek.

## İlk iş: cihaz kurulumu

Telefon: iPhone 15 Plus, UDID `00008120-001471580209A01E`. Geliştirici Modu açık; devicectl görüyor
ama "unavailable". Kullanıcıdan: telefon kilidi açık, kabloyla bağlı, "Bu bilgisayara güven", Xcode →
Settings → Accounts'ta Apple ID. Sonra:

1. `xcrun devicectl list devices` → durum "available/connected" olmalı.
2. `npm run ios:open` → App hedefi → Signing & Capabilities → Team: kişisel ekip
   (bundle id `com.mirzayildiran.kartlimitlerim`). İlk kurulumda telefonda Ayarlar → Genel →
   VPN ve Cihaz Yönetimi → geliştiriciye güven.
3. `npm run ios:build` ile paketli sürüm, cihaza kur; sonra `npm run ios:dev` ile canlı test.
4. Cihazda doğrula: açılış süresi; yazılım klavyesi + Kaydet; Face ID eşleşen/eşleşmeyen; son ödeme
   bildirimi ve dokununca ekstre; ana ekran hızlı eylemleri (uzun basma); asistan sohbeti (gerçek POST 200);
   yedek paylaşım menüsü; gizlilik bağlantısı Safari'de açılıyor mu; VoiceOver turu (Özet, cüzdan kaydırma,
   Kesime kadar eğrisi, bir pencere, kilit ekranı); Dynamic Type.

Not: oturumlar arası mesaj sınırı var (kullanıcı yazmadan 10 mesaj); sınıra gelince sonucu sohbete yaz.
