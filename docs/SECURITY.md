# Güvenlik ve gizlilik denetimi

Yayın öncesi denetim, 2026-10-10. Dal: `claude/security-pass`. Bulgular önem sırasıyla; her birinde durum yazıyor.

## Yapılanlar

- Asistan onayı kodda zorunlu; onay geri alınınca istek iptal (bulgu 1).
- Derlenen sayfada Content-Security-Policy (bulgu 3).
- Derin bağlantıda prototip anahtarı ve uzunluk sınırı (bulgu 5).
- Yedek dosyasında 20 milyon karakter sınırı (bulgu 6).
- Derlemede sır taraması: temiz (bulgu 7).

## Açık kalanlar

1. **Worker özetinin alan alan doğrulanması (orta, bulgu 2):** Bilinen anahtarlar, metin ve dizi sınırları; bilinmeyen alanlar atılsın. Gerekirse Turnstile ya da App Attest.
2. **Yedek kayıt şeması (düşük, bulgu 4):** En azından `accounts` için tür, kuruş ve tarih denetimi.
3. **iOS'ta CSP doğrulaması:** WKWebView'da `capacitor://localhost` için `'self'` ve Capacitor köprüsü (bulgu 3). Chromium'da doğrulandı, cihazda denenmedi.

## Bulgular

| # | Önem | Bulgu | Durum |
|---|---|---|---|
| 1 | Yüksek | Asistan onayı yalnızca arayüzde uygulanıyordu | Düzeltildi |
| 2 | Orta | Worker, Origin taklidiyle genel bir LLM aracısı gibi kullanılabilir | Açık, öneri aşağıda |
| 3 | Orta | Content-Security-Policy yoktu | Düzeltildi |
| 4 | Düşük | Yedek geri yüklemede kayıt içi alanlar doğrulanmıyor | Açık, öneri aşağıda |
| 5 | Düşük | Derin bağlantıda prototip anahtarları ve sınırsız uzunluk | Düzeltildi |
| 6 | Düşük | Yedek dosyasında boyut sınırı yoktu | Düzeltildi |
| 7 | Bilgi | Derlemede sır yok | Temiz |

## 1. Asistan onayı kodda zorunlu değildi (yüksek, düzeltildi)

**Önce:** Onay yalnızca arayüzde vardı: onay yokken `ChatPanel` gösterilmiyordu. `askAssistant()` onayı hiç denetlemiyordu; başka bir çağıran onaysız istek atabilirdi. Onay geri alınınca sürmekte olan istek iptal edilmiyor, yalnızca yanıtı yok sayılıyordu.

**Şimdi:**
- `askAssistant()` zorunlu bir `consented` alanı ister. TypeScript her çağıranı bu alanı vermeye zorlar. Alan `true` değilse ağ çağrısından önce `no_consent` hatası atılır (`src/ai/client.ts`).
- `ChatPanel` onay durumunu doğrudan `assistantConsent` sinyalinden geçirir.
- Onay geri alınınca ya da sohbet kapatılınca (`resetChat`) sürmekte olan istek `AbortController` ile iptal edilir.
- Test: onaysız çağrıda `fetch` hiç çalışmaz.

**Cihazdan çıkan alanlar** (`BudgetSummary`, `src/domain/insightsTypes.ts`): tarih; harcama gücü toplamları; kesime kadar görünüm; hesaplar (kullanıcının yazdığı ad, tür, kullanılabilir tutar, limit, en yakın ekstre); kategori adları ve bu ay/geçen ay toplamları; ay gidişatı; bütçe hedefleri; kurala dayalı önerilerin metni; kullanıcının mesajları (son 12, her biri en çok 1.000 karakter).

Gönderilmeyenler: tek tek harcamalar, notlar, düzenli ödeme adları, yedek, kart numarası ya da şifre (uygulama bunları zaten istemez).

Hesap ve kategori adları kullanıcının serbest metnidir; kişisel bilgi içerebilir. Onay ekranı gönderilecek özetin tam hâlini gösterir.

## 2. Worker genel bir LLM aracısı gibi kullanılabilir (orta, açık)

`Origin` başlığı tarayıcı dışında taklit edilebilir; README'de de böyle yazıyor. `parseAssistantRequest` özetin yalnızca biçimini denetler, içindeki alanlara bakmaz. Bu yüzden biri `summary` içine 16 KB'a kadar keyfi metin koyup Worker'ı ücretsiz bir LLM aracısı gibi kullanabilir. Sonuç sağlayıcı kotalarının tükenmesi ve asistanın gerçek kullanıcılar için `unavailable` dönmesidir.

**Mevcut önlemler:**
- IP başına dakikada 10 istek (Workers Rate Limiting), saatte 30 istek (isolate başına).
- 16 KB gövde sınırı.
- Konuya sınırlı sistem istemi; özetteki talimatlar veri sayılır.
- Sağlayıcı anahtarları istemciye hiç gelmez.

**Öneri (sıradaki iş):**
1. `parseAssistantRequest` özeti alan alan doğrulasın: bilinen anahtarlar, metin uzunluğu sınırları, dizi boyları (ör. en çok 30 hesap ve 30 kategori). Bilinmeyen alanlar atılsın.
2. Gerekirse Cloudflare Turnstile ya da iOS App Attest ile istemci doğrulaması.

## 3. Content-Security-Policy (orta, düzeltildi)

Derlenen `index.html`'e (web ve iOS) bir CSP `<meta>` eklenir: `vite.csp.ts`, yalnızca derlemede. Geliştirme sunucusu çalışma anında `<style>` enjekte ettiği için orada yoktur.

```
default-src 'self';
script-src 'self' 'wasm-unsafe-eval' 'sha256-<tema betiği>';
style-src 'self' 'sha256-<açılış stili>';
img-src 'self' data: blob:; font-src 'self' data:;
connect-src 'self' <Worker kökeni>; worker-src 'self';
object-src 'none'; base-uri 'none'; form-action 'none'
```

- Satır içi betik ve stilin özetleri derleme anında hesaplanır; içerikleri değişince politika bozulmaz.
- `connect-src` yalnızca `VITE_ASSISTANT_PROXY_URL` kökenine açıktır.
- `'wasm-unsafe-eval'`, OCR'ın Tesseract WebAssembly'si için gerekir.
- **Chromium'da doğrulandı:** native (`CAP_NATIVE=1`) ve web (`/kart-limitlerim/`, service worker'lı) derlemelerinde akış baştan sona çalıştı ve hiç `securitypolicyviolation` olmadı. Denenen akış: açık temada açılış, örnek veri, dört sayfa, asistana istek, gerçek bir görüntüyle OCR.
- **iOS'ta doğrulanmalı:** WKWebView'da `capacitor://localhost` için `'self'` eşleşmesi ve Capacitor köprüsü. Köprü WKUserScript olarak enjekte edildiği için CSP'ye takılmaması beklenir.

## 4. Yedek geri yüklemede kayıt içi alanlar doğrulanmıyor (düşük, açık)

`parseBackup` uygulama adını, şema sürümünü, beş listenin varlığını ve her kaydın `id`'sini denetliyor. Kayıtların iç alanlarına bakmıyor; örneğin `limit` metin olabilir ya da `kind` bilinmeyen bir değer olabilir.

- **Risk:** Bozuk ya da kötü niyetli bir yedek hesaplarda `NaN` ve ekran hatalarına yol açabilir.
- **XSS yok:** Preact metni kaçışlar; kodda `innerHTML`, `dangerouslySetInnerHTML` ya da `eval` yok.
- **Dosya kaynağı:** Dosyayı kullanıcının kendisi seçer.
- **Öneri:** Kayıt başına şema doğrulaması (tür, para alanlarının tam sayı kuruş olması, tarih biçimi), en azından `accounts` için.

OCR tarafında görüntü cihazda okunur. Okunan satırlar yalnızca kullanıcının gözden geçirme ekranında onayladıklarıyla kaydedilir; ayrıştırıcı yalnızca metin üretir.

## 5. Derin bağlantılar (düşük, düzeltildi)

`kartlimitlerim://` bağlantıları izin listesindeki rotalara ve `ekstre/<hesap>/<satır>` biçimine eşleniyor. Bilinmeyen hesap takvime düşüyor ve kilit açılmadan hiçbir şey açılmıyor.

Bulunan iki açık:
- **Prototip anahtarları:** Arama düz bir nesne üzerinde yapılıyordu; `kartlimitlerim://constructor` ya da `__proto__` prototip üyesini döndürüyordu. Etkisi takvime düşmekti. Artık yalnızca nesnenin kendi anahtarları sayılıyor (`Object.hasOwn`).
- **Uzunluk:** Hesap kimliğinin sınırı yoktu. Artık en çok 64 karakter; bağlantının tamamı en çok 200 karakter.

Testler eklendi (`src/platform/deeplinks.test.ts`).

## 6. Yedek dosyası boyut sınırı (düşük, düzeltildi)

`parseBackup` 20 milyon karakterden büyük metni ayrıştırmadan reddeder (`MAX_BACKUP_CHARS`). Gerçek yedekler bunun çok altındadır.

## 7. Derlemede sır yok (bilgi)

Web ve `CAP_NATIVE` derlemesinde `dist/` (OCR dosyaları dahil) şu desenlerle tarandı: Google, Groq, Cloudflare, OpenAI, OpenRouter ve GitHub anahtar ve token biçimleri, `Bearer`, özel ağ adresleri.

- **Anahtar, token, özel adres:** Hiçbiri yok. Tek eşleşme OCR wasm'ının base64 içeriğinde rastlantısal bir dizi (`AIzaAAAA…`).
- **Worker adresi:** Derlemede bulunan `https://kart-limitlerim-asistan.kart-limitlerim-7e48db.workers.dev` adresi beklenen ve herkese açık bir değer.
- **Kaynak haritası ve `.env`:** Kaynak haritası üretilmiyor. `.env`, `.env.*` ve `.dev.vars` git dışında.
- **Kullanılmayan adresler:** `cdn.jsdelivr.net` ve `localhost:3000`, tesseract.js'in pakete gömülmüş varsayılan ayarlarından geliyor. Uygulama `workerPath`, `corePath` ve `langPath`'i kendi `ocr/` klasörüne yönlendiriyor; CDN'e istek gitmiyor (CSP de engellerdi).

## Worker (girdi, boyut, günlük)

- **Girdi:** `parseAssistantRequest` sürümü, mesaj sayısını (1–12), rolleri, metin uzunluğunu (1.000) ve son mesajın kullanıcıdan gelmesini denetler. Özetin yalnızca biçimine bakılır (bkz. 2).
- **Boyut:** `content-length` ve gerçek gövde 16 KB ile sınırlı; aşınca 413.
- **Günlük:** Yalnızca sağlayıcı adı ve hata türü yazılır; istek gövdesi, özet ve yanıt metni yazılmaz. Sağlayıcı hata gövdesi istemciye iletilmez. Testle doğrulanıyor (`worker/assistant-proxy/src/index.test.ts`).
- **IP adresi:** Yalnızca bellekte, saatlik sayaçta tutulur; sağlayıcılara iletilmez.
