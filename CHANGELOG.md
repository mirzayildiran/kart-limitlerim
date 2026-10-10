# Değişiklik günlüğü

Bu dosya [Keep a Changelog](https://keepachangelog.com/tr/1.1.0/) biçimini izler ve sürüm numaraları [Semantic Versioning](https://semver.org/lang/tr/) ile verilir.

## [0.2.0] - Taslak (yayımlanmadı)

`package.json` sürümü yayın günü 0.2.0'a çekilecek (`npm run ios:release` sürüm damgasını oradan alır).

### Added

- İlk açılış ekranı ("Cüzdanını kuralım"): kart ekle, örnek verilerle dene, yedekten geri yükle. iPhone'da ilk karttan sonra bir kerelik ön izin penceresi (hatırlatıcılar ve Face ID).
- iPhone'da otomatik yerel yedek: her değişiklikten sonra son üç kopya uygulamanın özel klasörüne yazılır. Veritabanı boş açılır ve yedekte veri varsa ana ekran "Önceki verilerin bulundu" önerisini ilk açılış içeriğinin önüne koyar.
- iPhone: Face ID kilidi (açıldı / kapatıldı / tanınmadı mesajları), son ödeme bildirimleri ve dokununca ekstre, ana ekran hızlı eylemleri ve `kartlimitlerim://` bağlantıları, Dynamic Type, klavye uyumu.
- Erişilebilirlik tercihleri: büyük metin, hareketi azalt, kontrastı artır.
- Son ödeme tarihi hafta sonuna ya da resmi tatile denk gelirse bir sonraki iş gününe kayar. 2026–2028 resmi tatil tablosu (dini bayramlar ve arifeler dahil; kaynak 2429 sayılı Kanun ve Diyanet). Arife yarım gün olduğu için kaydırmaz.
- Yedek dosyasında şema sürümü 2 ve eski dosyalar için 1→2 geçişi (`migrate`). Her kayıt alan alan doğrulanır, bilinmeyen alanlar atılır; hata mesajı bozuk kaydı söyler ("3. harcama, tutar geçersiz"). Dosya boyutu okunmadan önce denetlenir. Otomatik yedek ve "Yedeği dışa aktar" aynı biçimi yazar.
- Asistan özetine süren taksitlerin toplamı (bu ayki ve kalan).
- Güvenlik: derlenen sayfada Content-Security-Policy; asistan onayı kodda zorunlu ve onay geri alınınca istek iptal; derin bağlantıda prototip anahtarı ve uzunluk sınırı; Worker özeti alan alan yeniden kurar. Denetim raporu `docs/SECURITY.md`.
- Testler: bileşen testleri (happy-dom, Testing Library: pencere odak tuzağı ve Escape, kilit ekranı, ilk açılış ve geri yükleme önerisi, tutar alanı, harcama formu), uçtan uca testler (Playwright, 390×844, koyu ve açık tema: örnek veri, harcama ve kart ekleme, Takvim'den ödeme, yedek dışa aktar → sil → geri yükle, asistan onay ekranı, axe-core taraması), tablo tabanlı finans testleri (ay sonu, şubat ve artık yıl, yıl geçişi, tatiller, oran dilimleri, faiz), 26 soruluk ağsız asistan değerlendirme seti.
- CI: Worker tip denetimi, knip, birim ve bileşen testleri, uçtan uca testler (Playwright Chromium önbellekli), iki derlemede CSP denetimi (`npm run check:csp`), ilk yükleme bütçesi (JS ≤ 40 KB, CSS ≤ 12 KB gzip; `npm run size`).

### Changed

- Açılış: açılış örtüsü HTML'de (`#boot`), sayfalar ve pencereler tembel yüklenir. Yedek kodu da ilk kullanımda yüklenir; ilk JS 40,0 KB'tan 37,5 KB'a (gzip) indi.
- Asistan: sistem istemi kısaldı ve alan sözlüğü eklendi; özet modele boş alanları atılarak gider (örnek veride 4.546 → 4.006 karakter). Hesap ve kategori adlarındaki kart, telefon, IBAN ya da kimlik numarasına benzeyen rakam dizileri ve e-postalar gönderilmeden maskelenir.
- Kod sağlığı: kullanılmayan `LimitStrip` bileşeni ve iki fonksiyon silindi, 57 gereksiz dışa aktarım kaldırıldı. Lint uyarı sınırı 0.

### Fixed

- KMH'de yalnızca gecikme oranı girilince akdi oran kart oranıyla (%3,25) dolduruluyordu; artık nakit/KMH azami oranı (%4,25).
- Harcama ekranındaki faiz uyarısı faiz dilimini tek harcamanın tutarına göre seçiyordu; artık kartta kullanılan tutar artı harcamaya (dönem borcu tahmini) göre.
- Ayarlar'daki faiz tablosu dilimleri "Limit" diye etiketliyordu; TCMB dilimleri dönem borcuna göredir. Etiket "Dönem borcu" oldu.
- KKDF ve BSMV çarpanı (1,30) dört yerde elle yazılıydı; tek yerden (`src/domain/rates.ts`) hesaplanıyor.
- Ekstre penceresinde oran "aylık %3.25" diye noktalı yazılıyordu; "%3,25".
- Alan ipuçları ve ekran görüntüsü gizlilik notu açık temada 3,2:1, koyu temada 3,6:1 kontrastla yazılıyordu (axe); artık `--muted` (AA).

### Security

- `npm audit`: `@capacitor/cli` → `xcode` → `uuid@7` (orta, yalnızca geliştirme aracı) bilinçli olarak açık bırakıldı; ayrıntı `docs/SECURITY.md`.

## [1.0.0] - 2026-10-10

### Added

- Kartlar, KMH, nakit ve hesaplar; kullanılabilir limite göre sıralı limit şeritleri ve harcama gücü özeti (kartlar, KMH, nakit).
- Kesim ve son ödeme takvimi, asgari ödeme takibi. Ekstre tutarı, asgari ödeme, ödenen tutar, kesin son ödeme tarihi ve ekstredeki faiz tutarı girilebilir.
- "Kesime kadar" ve "ödemelerden sonra nakit" hesapları; düzenli ödemeler ve asgari ödemeler bu hesaplara dahil edilir.
- Harcama ekleme, düzenleme ve silme. Harcama, kaynağın kullanılabilir limitinden ya da bakiyesinden düşebilir; değişiklik tek bir işlemde yazılır.
- Kendi kategorilerini oluşturma, adlandırma ve arşivleme. Harcaması ya da düzenli ödemesi olan kategori silinemez; arşivlenebilir.
- Taksitli harcamalar: harcama ekranında taksit sayısı seçilir; tutarın tamamı kart limitinden düşer.
- Düzenli ödemeler: gün, başlangıç tarihi, bitiş kuralı (sınırsız, tarihe kadar, adet kadar) ve takvim görünümü.
- Faiz tahmini: kart başına kesimden sonraki faiz (akdi faiz, gecikme faizi, KKDF ve BSMV), senaryolar (yalnızca asgari, hiç ödemeden, girildiği gibi), kart başına toplam işleyen faiz ve faiz geçmişi.
- KMH için günlük ve aylık faiz tahmini.
- Kart başına akdi ve gecikme oranını elle değiştirme. Girilmezse TCMB azami oranları (1 Ekim 2026) kullanılır.
- Ekran görüntüsünden harcama aktarma: cihaz üzerinde OCR (Tesseract.js, Türkçe model), iki okuma geçişi, banka düzenleri için ayrıştırıcılar (Ziraat Dinamik, Ziraat Bankkart, Akbank, İş Bankası, Garanti) ve genel bir yedek ayrıştırıcı.
- Aktarma gözden geçirme ekranı: satır seçimi, tutar ve tarih düzenleme, kategori önerisi, mükerrer kayıt kontrolü ve düşük güvenli satırlar için uyarı.
- Kategori önerisini öğrenme: kullanıcı önerinin dışında bir kategori seçerse aynı satıcı için kural kaydedilir.
- Yedek alma (JSON dosyası olarak indirme) ve yedekten geri yükleme. Geri yükleme onay ister ve dosyayı önce doğrular.
- "Tüm verileri sil" (Ayarlar).
- Açık, koyu ve sistem temasıyla görünüm tercihi.
- Çevrim dışı çalışma ve "ana ekrana ekle" (PWA). Yeni sürüm hazır olduğunda kullanıcıya bildirilir.
- Kalite kapısı: tip denetimi, Vitest testleri, ESLint ve renk kontrolü (`npm run lint`), CI ve GitHub Pages yayını.

## [0.1.0] - 2026-10-08

### Added

- Proje iskeleti: Vite, Preact, TypeScript ve vite-plugin-pwa ile PWA yapılandırması.
- GitHub Actions: CI (tip denetimi, test, derleme) ve GitHub Pages yayını.
