# Bulut oturumu devir notu (2026-10-10, ~12:00)

Uzun soluklu geliştirici ve entegratör oturumu. Görev listesi A–K'nin tamamı `main`'de; son `main` = `675d244`.
Bu not yalnızca `claude/cloud-handoff-2` dalında, `main`'e girmez. Her görev kendi `claude/cloud-*` dalında yapıldı,
kapıdan (tsc, Worker tsc, birim + bileşen testleri, lint, build; gerektiğinde e2e) geçip `main`'e ileri sarımla alındı.

Başlangıç: `main` = `3406a74` (data-safety zaten alınmıştı). Bitiş: 1007 birim/bileşen testi, 22 uçtan uca test
(iki temada), lint uyarısı 0, knip temiz, ilk JS 37,6 KB / CSS 9,4 KB (gzip).

## Görevler

| Görev | Durum | Commit(ler) |
|---|---|---|
| A1 claude/data-safety | Bitti (başlangıçta zaten `main`'deydi) | `02a86de`, birleşme `3406a74` |
| A2 design/onboarding | Bitti. Çakışmalar oturumda çözülmüştü; main.tsx'te dismissBoot + startAutoBackup + startPhoneSetup, SheetHost'ta tembel pencereler + `phoneSetup` birlikte. Geri yükleme önerisi birincil, ilk açılış ikincil (bileşen testiyle doğrulandı). | `c47064d` |
| A3 claude/security-pass | Bitti. CSP iki derlemede ihlalsiz (Chromium); `scripts/check-csp.mjs` + `npm run check:csp`, CI'da. Hash'ler derlemede hesaplanıyor; bilerek bozulmuş betikte ihlal yakalandığı doğrulandı. | `f360787`, `b3afaba` |
| B Güvenlik açıkları (iOS dışı) | Bitti. Worker özeti alan alan (`parseSummary`), yedek kayıt şeması (`backupSchema.ts`). | `885fec2`, `aff503f`, `056161f` |
| C Finansal doğruluk | Bitti. Ayrıntı aşağıda. | `89afcb0`, `2fb49e9`, `dc95063` (oran biçimi) |
| D Yedek biçimi | Bitti (B ile birlikte): şema 2, `migrate()`, doğrulama, boyut sınırları, ortak `serializeBackup`. | `aff503f`, `056161f` |
| E Bileşen testleri | Bitti: Sheet, LockScreen, HomePage (ilk açılış/öneri), MoneyField, ExpenseSheet. 33 test. | `d251870` |
| F Uçtan uca testler | Bitti: akışlar, yedek döngüsü, asistan (route ile Worker taklidi), tema, axe her sayfada + pencerelerde. Bulunan ihlal (ipucu kontrastı) düzeltildi. | `dc95063`, `675d244` |
| G CI | Bitti: worker tsc, knip, birim + bileşen ayrı adım, boyut bütçesi, e2e işi (Chromium önbellekli), iki derlemede CSP. | `4667428`, `1d6f13a`, `675d244` |
| H Asistan kalitesi | Bitti: 26 soruluk ağsız değerlendirme seti, kısa istem + alan sözlüğü, sıkıştırılmış özet, taksit toplamı, adlarda kimlik maskeleme. Gerçek API çağrısı yok. | `e88bc1e` |
| I Kod sağlığı | Bitti: knip temiz (57 dışa aktarım, LimitStrip, 2 fonksiyon), lint `--max-warnings 0`. npm audit: kısmi (aşağıda). | `497d044`, `1d6f13a` |
| J Belgeler | Bitti: README, ARCHITECTURE, CHANGELOG 0.2.0 taslağı, APP_STORE yapılacaklar. | `c10272e` |
| K Mağaza görselleri | Bitti: `node scripts/shots.mjs --store`, konsol hatası ve açılamayan pencere yok, 12 görüntü gözle kontrol edildi. | `56845d0` |

### C ayrıntısı (bulunan hatalar)

1. Son ödeme yalnızca hafta sonunda kayıyordu; resmi tatiller yoktu. `src/domain/holidays.ts`: sabit günler her yıl,
   dini bayramlar 2026–2028 (Diyanet), arifeler yarım gün olduğu için **kaydırmıyor** (karar: banka sabah açık;
   gereksiz kaydırma kullanıcıyı gecikmeye düşürebilir). Kullanıcının ekstreden girdiği kesin tarih kaydırılmıyor.
2. KMH'de yalnızca gecikme oranı girilirse akdi oran %3,25 (kart) doluyordu → %4,25 (nakit/KMH).
3. Harcama faiz uyarısı dilimi tek harcamaya göre seçiyordu → kullanılan + harcama.
4. Ayarlar faiz tablosu "Limit" diyordu; TCMB dilimleri dönem borcuna göre → "Dönem borcu".
5. KKDF+BSMV çarpanı 4 yerde elle → `withTaxes` (`rates.ts`, tek yapılandırma; kaynaklar dosya başında).
6. Ekstre penceresinde "aylık %3.25" → "%3,25".
Oranlar (TCMB 1/10/2026 tablosu, BDDK 11581: limit ≤ 100.000 ₺ %20, üstü %40) güncel kaynaklarla tutarlı.
Kesim günü ay sonu/şubat/artık yıl/yıl geçişi doğru çıktı (dört yıl × 31 gün taraması dahil); hata yoktu.

## Açık kalanlar

- **npm audit:** `@capacitor/cli` → `xcode@3.0.1` → `uuid@7.0.3` (3 orta). Düzeltme major atlaması; yapılmadı, `docs/SECURITY.md`'de gerekçe.
- **knip** bağımlılık değil, `npx -y knip@5.88.1` ile çalışıyor: bağımlılık olarak eklenince `braces` üzerinden 4 yüksek audit bulgusu getiriyordu.
- **Uygulama davranışı (karar bekliyor):** ilk ziyarette PWA'nın "Uygulama çevrim dışı da çalışır." bildirimi o an gösterilen bildirimin
  (ör. "Geri al"lı harcama bildirimi) yerine geçebiliyor. e2e'de servis çalışanı kapatılarak testler deterministik yapıldı; uygulamada
  bildirim kuyruğu ya da çevrim dışı bildiriminin ertelenmesi düşünülmeli.
- **Worker istemci doğrulaması** (Turnstile / App Attest): `docs/SECURITY.md` bulgu 2'nin kalanı.
- **İlk yılda %40 asgari** kuralı bazı bankalarda uygulanıyor; modellenmedi (`rates.ts` yorumunda).
- **2028 bayram tarihleri** Diyanet'in uzun vadeli listesinden; o yılın resmî takvimiyle yeniden karşılaştırılmalı.
- **`package.json` sürümü** hâlâ 0.1.0; CHANGELOG'da 0.2.0 taslağı var. Yayın günü yükseltilip `npm run ios:release`.
- Protokolde yeni isteğe bağlı alan var (`summary.installments`); Worker `main` push'unda deploy.yml ile kuruldu. Eski uygulama
  sürümleri bu alanı göndermez, sorun değil.

## Yerel oturumlara öneriler (cihazda denenecekler)

1. **CSP, WKWebView:** Safari Web Inspector konsolunda "Refused to …" olmamalı; Capacitor köprüsü, OCR (wasm), asistan isteği çalışmalı.
2. **Otomatik yedek döngüsü:** artık karşılaştırma normalleştirilmiş veriyle (`normalizeSnapshot`). Değişiklik yapmadan iki kez soğuk açılışta
   `Library/autobackup/` kopyalarının dönmediğini; bir değişiklikte tek döndüğünü; 3 kopya döngüsünü doğrulayın. Yedek kodu artık
   `import()` ile yükleniyor (yalnız iOS'ta), ilk açılışta öneri hâlâ çıkmalı.
3. **Şema 2 yedek:** cihazdaki eski (şema 1) bir otomatik yedekten geri yükleme ve paylaşım menüsüyle dışa aktarılan dosyanın başka cihazda
   açılması. Bozuk dosyada hata metni kaydı söylemeli.
4. **Tatil kayması:** son ödemesi 29 Ekim'e (Perşembe) denk gelen bir kart: takvim ve bildirim 30 Ekim'i göstermeli.
5. **Asistan:** gerçek POST 200; onay ekranında "Süren taksitlerinin toplamı" satırı; adında "1234" geçen bir hesabın özette "••••" görünmesi.
6. **Erişilebilirlik:** alan ipuçlarının rengi `--muted` oldu (DESIGN.md'de `dusk-faint` yalnız ek/yer tutucu/devre dışı). VoiceOver ve
   Kontrastı Artır ile pencereler.
7. Devir notundaki iOS cihaz kurulumu adımları (`handoff/ios`) hâlâ geçerli.

## Kullanılan dallar

`claude/cloud-onboarding`, `claude/cloud-security`, `claude/cloud-guvenlik`, `claude/cloud-finans`, `claude/cloud-yedek`,
`claude/cloud-bilesen-test`, `claude/cloud-e2e`, `claude/cloud-ci`, `claude/cloud-asistan`, `claude/cloud-saglik`,
`claude/cloud-saglik-2`, `claude/cloud-belgeler`, `claude/cloud-magaza`, `claude/cloud-e2e-sw`. Hepsi `main`'e alındı; silinebilir.
