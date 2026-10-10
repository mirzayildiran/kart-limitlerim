# Bütçe asistanı proxy'si

Kart Limitlerim'deki bütçe asistanı, mesajlarını doğrudan bir LLM sağlayıcısına göndermez. Önce bu küçük Cloudflare Worker'a gider. Worker, sağlayıcı anahtarlarını tutar, isteği kontrol eder ve sırayla ücretsiz sağlayıcılara iletir (Gemini, Groq, OpenRouter). Anahtarlar tarayıcıya hiç gelmez.

## Ne yapar

- `POST /` (ya da `POST /chat`) isteğini alır. Gövde `{ v: 1, summary, messages }` biçimindedir.
- İsteği doğrular: biçim, mesaj sayısı, metin uzunlukları ve gövde boyutu.
- Kaynak (Origin) sitesini `ALLOWED_ORIGINS` listesiyle sınırlar.
- IP başına dakikada 10 istek (LIMITER binding) ve saatlik kaba bir fren uygular (varsayılan 30 istek).
- Bütçe özetini ve sohbeti sağlayıcıya gönderir. Sağlayıcı hata verirse ya da boş yanıt dönerse bir sonrakini dener.
- Başarıda `{ text, provider }` döner.

## Gizlilik

- Worker istek gövdesini, bütçe özetini ya da mesajları **kaydetmez**. Log yalnızca sağlayıcı adını ve hata türünü yazar.
- Sağlayıcı hata gövdesi istemciye iletilmez; istemciye yalnızca sabit hata kodları döner.
- Anahtarlar yalnızca Wrangler "secret" olarak saklanır. `wrangler.toml` içinde anahtar yoktur ve olmamalıdır.
- **Önemli:** Ücretsiz katmanlardaki bazı sağlayıcılar gönderilen istemleri model eğitimi için kullanabilir. Gemini'nin ücretsiz katmanı bunu yapar. Bu durum uygulamanın onay ekranında listelenen sağlayıcılarla açıklanmalıdır. Kullanıcı onay vermeden hiçbir veri gönderilmez.

## Kurulum

Komutları bu klasörde (`worker/assistant-proxy`) çalıştır.

1. Wrangler'ı kur (ya da `npx wrangler` ile doğrudan kullan):

   ```bash
   npm i -g wrangler
   ```

2. Cloudflare hesabına giriş yap:

   ```bash
   wrangler login
   ```

3. En az bir sağlayıcı anahtarı ekle. Üçü de isteğe bağlıdır, ama en az biri gerekir:

   ```bash
   wrangler secret put GEMINI_API_KEY
   wrangler secret put GROQ_API_KEY
   wrangler secret put OPENROUTER_API_KEY
   ```

4. Worker'ı yayınla:

   ```bash
   wrangler deploy
   ```

   Çıktıdaki adres `https://kart-limitlerim-asistan.<hesap-alt-alanı>.workers.dev` biçiminde olur.

5. Uygulamayı bu adresle derle. Yerelde:

   ```bash
   VITE_ASSISTANT_PROXY_URL=https://kart-limitlerim-asistan.<hesap-alt-alanı>.workers.dev npm run build
   ```

   GitHub Pages için: repo ayarlarında **Settings → Secrets and variables → Actions → Variables** bölümüne `ASSISTANT_PROXY_URL` adıyla bir değişken ekle (yayın iş akışı bunu derlemeye `VITE_ASSISTANT_PROXY_URL` olarak verir). Bu değişken yoksa uygulama sohbetsiz derlenir; öneriler yine çalışır.

Yerelde geliştirmek için `wrangler dev` çalıştır. Anahtarları `.dev.vars` dosyasına yaz (`GEMINI_API_KEY=...` gibi). Bu dosya gizlidir ve `.gitignore` kapsamındadır.

## Ücretsiz anahtarları nereden alırsın

- **Gemini:** Google AI Studio (https://aistudio.google.com/apikey)
- **Groq:** https://console.groq.com
- **OpenRouter:** https://openrouter.ai (ücretsiz `:free` modeller kullanılır)

## Hız sınırı hakkında

İki katman var:

- **LIMITER** (`wrangler.toml` içindeki `[[ratelimits]]` binding'i): IP başına dakikada 10 istek. Cloudflare Workers Rate Limiting binding'i olduğu için ücretsiz planda çalışır. Sayaç, aynı Cloudflare lokasyonundaki isolate'ler arasında ortaktır. Binding hata verirse istek geçer ve yalnızca `assistant: limiter failed` loglanır.
- **Bellek içi saatlik fren** (`RATE_LIMIT_PER_HOUR`, varsayılan 30): her isolate kendi sayacını tutar. Bu yüzden sıkı bir sınır değil, ani patlamalara karşı bir frendir.

Cloudflare'in **WAF → Rate limiting rules** kuralları yalnızca özel alan adlarında (custom domain) çalışır; `workers.dev` adresinde çalışmaz. Bu yüzden bu worker için WAF kuralına güvenme; sınır LIMITER binding'inden gelir.

## CORS hakkında

Yalnızca `ALLOWED_ORIGINS` içindeki kaynaklar kabul edilir. Diğer kaynaklardan ve `Origin` başlığı olmayan isteklerden 403 döner. Bu bir güvenlik sınırı değildir, çünkü `Origin` başlığı tarayıcı dışında kolayca değiştirilebilir. Asıl koruma anahtarların sunucuda kalması ve hız sınırıdır.

Yeni bir kaynak eklemek için `wrangler.toml` içindeki `ALLOWED_ORIGINS` değerini düzenle ve `wrangler deploy` çalıştır.
