# Yol haritası

Her aşamanın sonunda telefonda denenebilir, çalışan bir sürüm çıkar.

## Aşama 0 — Araştırma ve temel ✅

- [x] Cihaz üzerinde OCR seçenekleri (Tesseract.js 7, Türkçe veri, iOS PWA kısıtları)
- [x] Kart faizi, KMH faizi, KKDF/BSMV ve asgari ödeme kuralları için ilk tarama
- [x] Faiz ve asgari ödeme oranlarının birincil kaynaklardan doğrulanması (TCMB ve BDDK kaynakları `src/domain/rates.ts` içinde tarih ile belirtili)
- [x] Proje iskeleti: Vite + Preact + TypeScript, PWA, CI, GitHub Pages
- [x] Tasarım dili ve bileşen seti (`src/ui/tokens.css`, `src/ui/components/`)

## Aşama 1 — Çekirdek PWA ✅

- [x] Veri modeli ve IndexedDB katmanı (hesaplar, ekstreler, harcamalar, kategoriler, düzenli ödemeler)
- [x] Harcama gücü ekranı: kartlar → KMH → nakit ve hesaplar → harcamalar → asgari ödemeler
- [x] Kesim ve son ödeme döngüsü, asgari ödeme takibi
- [x] Harcama ekleme; harcama kaynağın limitinden ya da bakiyesinden düşer
- [x] Kendi kategorilerini oluşturma
- [x] Düzenli ödemeler ve taksitler
- [x] Yedek dışa/içe aktarma (JSON)
- [x] Çevrim dışı çalışma ve "ana ekrana ekle" akışı (manifest ve service worker)

## Aşama 2 — Faiz motoru 🚧

- [ ] Güncellenebilir oran tablosu (kaynak ve geçerlilik tarihiyle). Tablo bugün kod içinde (`src/domain/rates.ts`); uzaktan güncelleme yok.
- [x] Asgari / kısmi / tam ödeme senaryolarında faiz tahmini
- [x] KMH günlük faiz tahmini
- [x] Kart bazında oranı elle değiştirme

## Aşama 3 — Ekran görüntüsünden aktarma 🚧

- [ ] Görüntü ön işleme (gri ton, ölçekleme, koyu tema tersleme) Web Worker'da. Tesseract kendi worker'ında çalışır; ön işleme bugün ana iş parçacığında.
- [x] Tesseract.js ile cihazda okuma; dil verisi uygulamayla birlikte, çevrim dışı
- [x] Banka bazında satır ayrıştırıcıları (Ziraat Dinamik, Ziraat Bankkart, Akbank, İş Bankası, Garanti)
- [x] Onay ekranı, mükerrer kontrolü, satıcıya göre kategori önerisi
- [ ] Android'de "Paylaş → Kart Limitlerim" (Web Share Target)

## Aşama 3.5 — Doğruluk

Gerçek ekran görüntüleriyle yapılan değerlendirmede beş bankada 29 satırın 28'i doğru okundu (28/29).

## Aşama 4 — App Store 🚧

Karar (2026-10-10): Öncelik App Store. Google Play çok sonraki bir plan. Ayrıntılar `docs/IOS.md`'de.

- [x] Capacitor ile iOS paketi (`ios/`), iPhone'da canlı test (`npm run ios:dev`)
- [x] Yedek dışa aktarma iOS paylaşım menüsüyle (`src/platform/files.ts`)
- [x] Face ID kilidi; uygulama değiştiricide bakiyeler gizli (`src/platform/lock.ts`)
- [x] Son ödeme yerel bildirimleri, iki gün önce ve son gün (`src/domain/reminders.ts`)
- [x] iOS dokunsal geri bildirim (`src/platform/haptics.ts`)
- [ ] Gerçek iPhone'da ilk deneme (Xcode kurulumu bekleniyor)
- [ ] `PrivacyInfo.xcprivacy` ve App Store gizlilik etiketleri
- [ ] Mağaza metinleri, ekran görüntüleri, gizlilik politikası adresi (App Store paketi ve kalan eksikler: `docs/APP_STORE.md`; sayfalar: `public/privacy.html`, `public/support.html`)
- [ ] Apple Developer Program üyeliği (TestFlight ve yayın için; şimdilik ücretsiz hesap)
- [ ] Android paketi (sonra)

## Aşama 4.5 — Bütçe asistanı 🚧

Karar (2026-10-10): Telefonda çalışan model yerine ücretsiz bulut API'leri kullanılacak. Uygulamanın boyutu büyümeyecek. Anahtarlar kullanıcıdan istenmez; projenin Cloudflare Workers üzerindeki aracı sunucusunda durur (`worker/assistant-proxy/`).

- [x] Kurala dayalı öneriler (yapay zekasız): kesime kadar nakit açığı, yaklaşan ve geciken asgari ödemeler, limiti azalan kart, KMH günlük faizi, asgari ödeme faizi, kategori artışları, "bugün hangi kartla öde". Rakamlar yalnızca `src/domain/` hesaplarından gelir (`src/domain/insights.ts`).
- [x] Sohbet ekranı (`#/asistan`): model uygulamanın hesapladığı özeti (`src/domain/insightsSummary.ts`) okur, açıklar ve tartışır. Model hesap yapmaz. Sohbet geçmişi yalnızca bellekte tutulur.
- [x] Sağlayıcı katmanı: aracı sunucu sırayla Gemini (`gemini-flash-lite-latest`), Groq (`openai/gpt-oss-120b`) ve OpenRouter'ı (ücretsiz model listesiyle) dener; sağlayıcı başına 12 sn, toplam 25 sn (`src/ai/`, `worker/assistant-proxy/`). CORS, IP başına dakikalık (Workers Rate Limiting) ve saatlik hız sınırı var. Gemini ve Groq yolları gerçek anahtarla uçtan uca denendi (Flash Lite ~1 sn; tam Flash ~60 sn sürdüğü için kullanılmıyor. Groq'un Llama 3.3 modeli kapatıldı, yerine gpt-oss-120b ~1 sn).
- [x] Bütçe planı: kategori başına aylık hedef, ay gidişatı ve tahmini ay sonu (`src/domain/budget.ts`). Hedef aşımı ve "bu hızla aşılır" önerileri; sohbet planı bu rakamlarla tartışır. Plan yedeğe girer.
- [x] Gizlilik: varsayılan kapalı. Onay ekranı gönderilecek alanları, gönderilmeyenleri, servisleri ve özetin tam hâlini gösterir. PRODUCT.md ilkesi ve `docs/PRIVACY.md` güncellendi.
- [x] Her yanıtta "Tahmindir, finansal tavsiye değildir." ibaresi (uygulama ekler, modele bırakılmaz).
- [x] Aracı sunucunun otomatik kurulumu: `deploy.yml` her `main` gönderiminde Worker'ı kurar ve adresini derlemeye verir (`scripts/deploy-assistant.sh`).
- [x] Depo gizli değerleri tanımlandı (2026-10-10): `CLOUDFLARE_API_TOKEN`, `GEMINI_API_KEY`, `GROQ_API_KEY`; yedek olarak `ASSISTANT_PROXY_URL` değişkeni. Worker adresi: `https://kart-limitlerim-asistan.kart-limitlerim-7e48db.workers.dev`.
- [ ] Ana ekrandan asistana giriş (şu an Ayarlar → Bütçe asistanı). Tasarım çalışmasıyla birlikte yerleştirilecek.

## Aşama 5 — İleri özellikler

- [ ] "Bu harcamayı hangi kartla yapmalıyım?" önerisi (boş limit ve faizsiz süreye göre)
- [ ] Taksitlerin aylara göre limit takvimi
- [ ] Ana ekran widget'ı
