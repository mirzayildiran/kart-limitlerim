# Yol haritası

Her aşamanın sonunda telefonda denenebilir, çalışan bir sürüm çıkar.

## Aşama 0 — Araştırma ve temel ✅ / 🚧

- [x] Cihaz üzerinde OCR seçenekleri (Tesseract.js 7, Türkçe veri, iOS PWA kısıtları)
- [x] Kart faizi, KMH faizi, KKDF/BSMV ve asgari ödeme kuralları için ilk tarama
- [ ] Faiz ve asgari ödeme oranlarının birincil kaynaklardan (TCMB, BDDK) doğrulanması
- [x] Proje iskeleti: Vite + Preact + TypeScript, PWA, CI, GitHub Pages
- [ ] Tasarım dili ve bileşen seti

## Aşama 1 — Çekirdek PWA

- [ ] Veri modeli ve IndexedDB katmanı (hesaplar, ekstreler, harcamalar, kategoriler, düzenli ödemeler)
- [ ] Harcama gücü ekranı: kartlar → KMH → nakit ve hesaplar → harcamalar → asgari ödemeler
- [ ] Kesim ve son ödeme döngüsü, asgari ödeme takibi
- [ ] Harcama ekleme; harcama kaynağın limitinden ya da bakiyesinden düşer
- [ ] Kendi kategorilerini oluşturma
- [ ] Düzenli ödemeler ve taksitler
- [ ] Yedek dışa/içe aktarma (JSON)
- [ ] Çevrim dışı çalışma ve "ana ekrana ekle" akışı

## Aşama 2 — Faiz motoru

- [ ] Güncellenebilir oran tablosu (kaynak ve geçerlilik tarihiyle)
- [ ] Asgari / kısmi / tam ödeme senaryolarında faiz tahmini
- [ ] KMH günlük faiz tahmini
- [ ] Kart bazında oranı elle değiştirme

## Aşama 3 — Ekran görüntüsünden aktarma

- [ ] Görüntü ön işleme (gri ton, ölçekleme, koyu tema tersleme) Web Worker'da
- [ ] Tesseract.js ile cihazda okuma; dil verisi uygulamayla birlikte, çevrim dışı
- [ ] Banka bazında satır ayrıştırıcıları
- [ ] Onay ekranı, mükerrer kontrolü, satıcıya göre kategori önerisi
- [ ] Android'de "Paylaş → Kart Limitlerim" (Web Share Target)

## Aşama 4 — Mağaza sürümleri

- [ ] Capacitor ile iOS ve Android paketleri
- [ ] Face ID / parmak izi kilidi
- [ ] Son ödeme hatırlatma bildirimleri
- [ ] Mağaza metinleri, ekran görüntüleri, gizlilik politikası

## Aşama 5 — İleri özellikler

- [ ] "Bu harcamayı hangi kartla yapmalıyım?" önerisi (boş limit ve faizsiz süreye göre)
- [ ] Taksitlerin aylara göre limit takvimi
- [ ] Ana ekran widget'ı
