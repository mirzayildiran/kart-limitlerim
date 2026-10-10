# Değişiklik günlüğü

Bu dosya [Keep a Changelog](https://keepachangelog.com/tr/1.1.0/) biçimini izler ve sürüm numaraları [Semantic Versioning](https://semver.org/lang/tr/) ile verilir.

## [Unreleased]

### Added

- Yedek dosyasında şema sürümü 2 ve eski dosyalar için 1→2 geçişi (`migrate`). Her kayıt alan alan doğrulanır, bilinmeyen alanlar atılır; hata mesajı bozuk kaydı söyler ("3. harcama, tutar geçersiz"). Dosya boyutu okunmadan önce denetlenir. Otomatik yedek ve "Yedeği dışa aktar" aynı biçimi yazar.
- Asistan Worker'ı özeti alan alan yeniden kurar; serbest metin kısa ad ve öneri alanlarıyla sınırlı.
- `npm run check:csp`: derlenmiş uygulamada Content-Security-Policy ihlali denetimi (web ve `CAP_NATIVE=1`).

### Fixed

- Son ödeme tarihi resmi tatile denk gelince bir sonraki iş gününe kayıyor (önceden yalnızca hafta sonu). 2026–2028 için resmi tatil tablosu (dini bayramlar ve arifeler dahil, kaynak: 2429 sayılı Kanun ve Diyanet); arife yarım gün olduğu için tarih kaydırılmaz.
- KMH'de yalnızca gecikme oranı girilince akdi oran kart oranıyla (%3,25) dolduruluyordu; artık nakit/KMH azami oranı (%4,25). Kart için en düşük dilim kullanılır.
- Harcama ekranındaki faiz uyarısı faiz dilimini tek harcamanın tutarına göre seçiyordu; artık kartta kullanılan tutar artı harcamaya (dönem borcu tahmini) göre seçiyor.
- Ayarlar'daki faiz tablosu dilimleri "Limit" diye etiketliyordu; TCMB dilimleri ve uygulamanın hesabı dönem borcuna göre. Etiket "Dönem borcu" oldu.
- KKDF ve BSMV çarpanı (1,30) dört yerde elle yazılıydı; tek yerden (`src/domain/rates.ts`) hesaplanıyor.

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
