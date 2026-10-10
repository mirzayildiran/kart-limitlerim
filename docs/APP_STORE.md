# App Store yayın paketi

Apple Developer Program üyeliği alınınca App Store Connect'e girilecek her şey bu dosyada. Uygulama: Kart Limitlerim 1.0 (Bundle ID `com.mirzayildiran.kartlimitlerim`, iOS 16+, yalnızca dikey). Kod ya da ayar gerektiren eksikler en sonda, **Yapılacaklar** bölümünde.

Hazırlanma tarihi: 2026-10-10. Apple kurallarının alıntıları aynı gün [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) sayfasından alındı.

## Adresler

| Alan | Değer |
|---|---|
| Gizlilik politikası (Privacy Policy URL) | `https://mirzayildiran.github.io/kart-limitlerim/privacy.html` |
| Destek (Support URL) | `https://mirzayildiran.github.io/kart-limitlerim/support.html` |
| Pazarlama (Marketing URL, isteğe bağlı) | `https://mirzayildiran.github.io/kart-limitlerim/` |

Sayfalar `public/privacy.html` ve `public/support.html` dosyalarından gelir. `main`'e girdikten sonraki ilk GitHub Pages yayınında açılırlar. İçerikleri `docs/PRIVACY.md` ile aynı tutulmalıdır: biri değişirse öteki de güncellenir.

## Genel bilgiler

| Alan | Değer |
|---|---|
| Ad (≤30) | **Kart Limitlerim** (TR ve EN aynı) |
| Ana ekrandaki ad | `Limitlerim` (Info.plist `CFBundleDisplayName`) |
| Birincil kategori | Finans (Finance) |
| İkincil kategori | Verimlilik (Productivity) |
| Fiyat | Ücretsiz, uygulama içi satın alma yok |
| Birincil dil | Türkçe. İngilizce sayfa yalnızca mağaza metni içindir; uygulama Türkçe. |
| Ülkeler | **Yalnızca Türkiye** (gerekçesi aşağıda, "Ülke kısıtı") |
| Telif (Copyright) | `2026 Ahmet Mirza Yıldıran` (geliştirici hesabındaki adla aynı olmalı) |
| Yaş derecelendirmesi | Anket sonucu 4+ çıkar; **en düşük yaş elle 18+ yapılmalı** (aşağıda) |

### Ülke kısıtı

Gemini API'nin ücretsiz katmanı AB, İsviçre ve Birleşik Krallık'taki kullanıcılara sunulamıyor. Koşullardaki ifade: *"You may use only Paid Services when making API Clients available to users in the European Economic Area"* ([Gemini API Additional Terms](https://ai.google.dev/gemini-api/terms)). Uygulama zaten Türkiye'deki bankalar, TCMB oranları ve Türkçe arayüz için yapıldığından ilk sürüm **yalnızca Türkiye**'de yayınlanır. Başka ülke eklenecekse önce bu kısıt çözülmelidir: AB'de Gemini'yi atlamak ya da ücretli katmana geçmek.

## Mağaza metinleri

### Türkçe

**Alt başlık (≤30):** `Boş limit ve harcama gücü` (25)

**Anahtar kelimeler (≤100, virgülle, boşluksuz):**
`kredi kartı,limit,kmh,bütçe,harcama,asgari ödeme,ekstre,faiz,kesim,taksit,son ödeme,nakit,borç` (94 karakter)

**Tanıtım metni (≤170):**
Bütün kartlarındaki, KMH'ndeki ve nakitteki boş tutar tek rakamda. Kesime kadar ne kalacağını ve yalnızca asgariyi ödersen faizin ne olacağını gör.

**Açıklama:**

```
Kart Limitlerim "ne kadar borcun var" yerine "şu an gerçekte ne kadar harcayabilirsin" sorusunu cevaplar.

HARCAMA GÜCÜ
Bütün kredi kartlarındaki boş limit, KMH'deki boş limit ve nakit tek rakamda. Hesaplar kullanılabilir tutara göre sıralanır.

KESİME KADAR
Bir sonraki ekstre kesimine kadar çıkacak düzenli ödemeler ve asgari ödemeler düşüldükten sonra elinde ne kalacağını gör. Nakit yetmeyecekse ne kadar eksik kalacağı yazar.

FAİZ TAHMİNİ
Yalnızca asgariyi ödersen sonraki ekstreye ne kadar faiz yansıyacağını gör: akdi faiz, KKDF ve BSMV dahil. KMH için günlük faiz tahmini. Oranlar TCMB azami oranlarından gelir; kartının kendi oranını girebilirsin.

TAKVİM VE HATIRLATMA
Kesim ve son ödeme tarihleri, asgari ödeme takibi, düzenli ödemeler. Son ödeme günü yaklaşınca isteğe bağlı bildirim.

EKRAN GÖRÜNTÜSÜNDEN AKTARMA
Banka uygulamasının harcama listesinin ekran görüntüsünü seç; harcamalar telefonda okunur, sen onaylayınca eklenir. Görüntü hiçbir yere gönderilmez ve saklanmaz. Tanınan bankalar: Ziraat Dinamik, Ziraat Bankkart, Akbank, İş Bankası, Garanti; diğerleri için genel okuyucu.

BÜTÇE ASİSTANI
Kategori hedefleri koy, ay gidişatını ve "bu hızla aşılır" uyarılarını gör. Öneriler tamamen cihazda hesaplanır. İstersen sohbeti açıp bütçeni bir yapay zekâ asistanıyla konuşabilirsin. Sohbet varsayılan olarak kapalıdır; açmadan önce hangi bilgilerin hangi servislere gideceğini gösteren bir onay ekranı çıkar.

VERİLERİN SENDE
Hesap yok, reklam yok, izleme yok. Bütün veriler yalnızca bu cihazda durur. Banka şifresi ya da kart numarası hiçbir zaman istenmez. Yedeğini JSON dosyası olarak alıp yeni telefonuna taşıyabilirsin.

Tutarlar tahmindir, finansal tavsiye değildir; banka ekstresi esastır. Kart Limitlerim bir banka uygulaması değildir; bankalara bağlanmaz ve para hareketi yapmaz.
```

**Bu sürümdeki yenilikler (What's New):** İlk sürüm için Apple bu alanı istemez. 1.0.1'den itibaren `CHANGELOG.md`'deki ilgili sürümün kısa özeti yazılır. Örnek biçim:

```
• Son ödeme hatırlatmaları artık kart başına ayarlanabiliyor.
• Hata düzeltmeleri.
```

### English

**Subtitle (≤30):** `Card limits & spending power` (28)

**Keywords (≤100):**
`credit card,limit,budget,spending,overdraft,minimum payment,statement,interest,due date,installment` (99 characters)

**Promotional text (≤170):**
Free limit across all your cards, overdraft and cash in one figure. See what is left until your statement date and what paying only the minimum will cost.

**Description:**

```
Kart Limitlerim answers "how much can I actually spend right now?" instead of "how much do I owe?". Built for credit cards, overdraft accounts (KMH) and banks in Turkey. The app is in Turkish.

SPENDING POWER
Free limit on every credit card, free overdraft and cash in a single figure, with accounts sorted by what is available.

UNTIL THE NEXT STATEMENT
See what is left after recurring payments and minimum payments due before your next statement date. If cash will not cover them, the app shows the shortfall.

INTEREST ESTIMATES
See the interest that lands on your next statement if you pay only the minimum, including contractual interest and Turkish taxes (KKDF, BSMV), plus daily overdraft interest. Rates default to the central bank's maximum rates; you can enter your card's own.

CALENDAR AND REMINDERS
Statement and due dates, minimum payment tracking and recurring payments, with optional due-date notifications.

SCREENSHOT IMPORT
Pick a screenshot of your banking app's transaction list. It is read on your phone and expenses are added after you confirm. The image is never uploaded or kept.

BUDGET ASSISTANT
Set monthly category targets and see how the month is going. Suggestions are computed entirely on your device. Optionally, turn on a chat to talk through your budget with an AI assistant. The chat is off by default and asks for your consent first, showing exactly what is sent and to which services.

YOUR DATA STAYS WITH YOU
No account, no ads, no tracking. All data stays on this device. The app never asks for bank passwords or card numbers. Export a JSON backup to move to a new phone.

Figures are estimates, not financial advice; your bank statement is authoritative. Kart Limitlerim is not a banking app: it does not connect to banks or move money.
```

## Ekran görüntüleri

| Ekran | Boyut (piksel, dikey) | Durum |
|---|---|---|
| iPhone 6.9" | 1320 × 2868 (1290 × 2796 ve 1260 × 2736 da kabul edilir) | Zorunlu: 1 ile 10 görüntü |
| iPhone 6.5" | 1284 × 2778 ya da 1242 × 2688 | 6.9" yüklenirse isteğe bağlı; Apple küçültür. Yine de ayrı yüklemek daha net sonuç verir. |
| iPad | Yalnızca uygulama iPad'i destekliyorsa gerekir | Bkz. Yapılacaklar: iPhone'a özel olmalı |

Önerilen sıra ve başlıklar (görüntünün üstüne kısa başlık):

1. Özet: "Şu an harcayabileceğin tek rakamda"
2. Kesime kadar: "Kesime kadar elinde ne kalacak"
3. Faiz tahmini: "Asgariyi ödersen faiz ne olur"
4. Takvim: "Kesim ve son ödeme bir bakışta"
5. Ekran görüntüsünden aktarma: "Görüntü telefondan çıkmaz"
6. Bütçe asistanı: "Kategori hedefleri ve öneriler"

Görüntüler örnek verilerle çekilmelidir; gerçek kart ya da kişi bilgisi olmamalıdır. `scripts/shots.mjs` zaten `src/data/demo-backup.json` ile çekim yapıyor. Mağaza boyutları için bkz. Yapılacaklar.

## Yaş derecelendirmesi anketi

Apple anketi yeniledi; yeni derecelendirmeler 4+, 9+, 13+, 16+ ve 18+. Yeni sorular 31 Ocak 2026'dan beri zorunlu. Sorular App Store Connect'te birebir görülmeli; aşağıdaki cevaplar konu başlıklarına göre:

| Soru grubu | Cevap |
|---|---|
| Şiddet, korku, cinsellik, çıplaklık, küfür, uyuşturucu, alkol, tütün | Yok |
| Kumar, şans oyunları, ödüllü yarışma, ganimet kutusu | Yok |
| Tıbbi ya da sağlık içeriği | Yok |
| Sınırsız web erişimi (Unrestricted Web Access) | Hayır. Uygulama yalnızca kendi içeriğini gösterir, tarayıcı içermez. |
| Kullanıcı içeriği (User-Generated Content) | Hayır. Kullanıcılar arasında paylaşım yok. |
| Mesajlaşma ve sohbet (Messaging and Chat) | Hayır. Kullanıcıdan kullanıcıya mesajlaşma yok. Yapay zekâ sohbeti ayrı soruda bildirilir. |
| Yapay zekâ asistanı / sohbet botu (anket sorarsa) | Evet. İsteğe bağlı, varsayılan kapalı; yalnızca kişisel bütçe konusunda konuşacak şekilde sınırlı (`src/ai/prompt.ts`). |
| Reklam | Hayır |
| Ebeveyn denetimi, yaş doğrulama | Hayır |

**En düşük yaş: 18+ yap.** Anket muhtemelen 4+ çıkarır. Ama Gemini API koşulları, 18 yaş altına yönelik ya da 18 yaş altının erişmesi muhtemel uygulamalarda kullanımı yasaklıyor: *"You must be 18 years of age or older to use the APIs"* ve aynı bölümde "likely to be accessed by individuals under the age of 18" yasağı. Kredi kartı ve KMH kullanıcıları zaten yetişkin. App Store Connect, geliştiricinin derecelendirmeyi elle yükseltmesine izin veriyor. 18+ olunca 4.7.5'teki yaş kısıtlama şartı da uygulama düzeyinde karşılanmış olur. Gizlilik sayfasında da "18 yaş ve üzeri" yazıyor.

## App Privacy (gizlilik etiketi)

App Store Connect → App Privacy. Apple'ın tanımı: veri, isteği o an karşılamak için gerekenden uzun süre senin ya da ortaklarının erişebileceği şekilde cihazdan çıkıyorsa "toplanmış" sayılır. Sohbet isteğe bağlı olsa da ücretsiz yapay zekâ servisleri metni saklayabildiği için bildirilmesi gerekir.

**"Bu uygulamadan veri topluyor musunuz?" → Evet**

| Veri türü (Apple adı) | Ne | Amaç | Kullanıcıya bağlı mı | İzleme |
|---|---|---|---|---|
| Finansal bilgi → Diğer finansal bilgiler (Other Financial Info) | Bütçe özeti: hesap adları, limitler, bakiyeler, ekstre tutarları, kategori toplamları, bütçe hedefleri | Uygulama işlevselliği (App Functionality) | **Hayır** | **Hayır** |
| Kullanıcı içeriği → Diğer kullanıcı içeriği (Other User Content) | Sohbete yazılan mesajlar | Uygulama işlevselliği | **Hayır** | **Hayır** |

Gerekçeler:

- **Bağlı değil:** Hesap, kimlik, cihaz kimliği ya da reklam kimliği yok. Aracı sunucu IP adresini yapay zekâ servislerine iletmez; servisler yalnızca Cloudflare'in adresini görür.
- **İzleme yok:** Veri başka şirketlerin verileriyle birleştirilmez, reklam için kullanılmaz, veri aracısına verilmez. App Tracking Transparency izni gerekmez.
- **Bildirilmeyenler:** Kart, harcama ve diğer bütün veriler cihazda kalır. Ekran görüntüleri cihazda okunur. Bildirimler yereldir. Analiz, çökme raporu ya da tanılama verisi yok.
- **IP adresi:** Aracı, kötüye kullanımı önlemek için IP'yi bellekte en çok bir saat tutar ve hiçbir yere yazmaz. Apple'ın veri türleri arasında IP için ayrı bir satır yok; konum çıkarılmadığı için "Konum" da işaretlenmez.
- **İsteğe bağlı bildirim (optional disclosure) uygulanmaz.** O istisna, kullanıcının adının gönderim formunda göründüğü durumlar içindir; burada öyle bir form yok.

## İhracat uyumu (şifreleme)

Uygulama yalnızca işletim sisteminin HTTPS'ini kullanır, kendi şifrelemesi yoktur. Bu yüzden muaftır: **`ITSAppUsesNonExemptEncryption = NO`**. iPhone oturumu bunu `ios/App/App/Info.plist`'e ekledi (`<false/>`). Bu anahtar olduğu için App Store Connect her yüklemede şifreleme sorusunu sormaz.

## İnceleme notları (App Review Information)

**Giriş bilgisi:** Gerekmez ("Sign-in required" işaretlenmez).

**Notlar (İngilizce yazılır):**

```
Kart Limitlerim is a personal budget tracker for credit cards, overdraft accounts and cash in Turkey. The UI is in Turkish.

- No account or sign-in. All data is stored on the device. The app does not connect to any bank, does not access financial accounts and does not move money; the user enters card limits and expenses manually or imports them from their own screenshots. Interest figures are labelled as estimates, not financial advice.
- To try it with sample data: on first launch tap "Örnek verilerle dene" (try with sample data) on the home screen. Seven sample accounts with expenses and recurring payments are loaded, dated relative to today. Remove them with Ayarlar (Settings) → Tehlikeli bölge → "Tüm verileri sil".
- To add data manually: on first launch the home screen ("Özet") shows "Kart ekle" (add card). Enter a name, limit, statement day and due day. Then tap the + button to add an expense. The home screen shows spending power.
- Screenshot import: tap + → "Ekran görüntüsünden ekle", then pick a screenshot of a banking app's transaction list. Text recognition runs on the device; the image is not uploaded.
- Due-date reminders (local notifications): Ayarlar (Settings) → Hatırlatmalar. Off by default.
- Budget assistant chat (optional, off by default): Ayarlar (Settings) → Bütçe asistanı → "Asistanı aç" (when there are suggestions, the "Bütçe asistanı" row on the home screen opens it too). Before anything is sent, a consent screen lists the exact data that will be sent, what is never sent, and the third-party AI services (Google Gemini, Groq, OpenRouter) via our proxy on Cloudflare Workers. Tap "Anladım, sohbeti aç" to consent; consent can be withdrawn in Settings at any time. The quick question "Bütçe planıma uyuyor muyum?" is a good test.
- Native features: Face ID lock, local due-date notifications, haptic feedback, share sheet for backups, on-device text recognition for camera/photos, full offline use.
- Privacy policy inside the app: Ayarlar (Settings) → Gizlilik → "Gizlilik politikası", and the link on the chat consent screen.
```

**İletişim:** Ad, telefon ve e-posta App Store Connect'te geliştirici hesabından girilir. Bu dosyaya yazılmaz.

**Demo verisi:** Boş ana ekranda "Örnek verilerle dene" düğmesi `src/data/demo-backup.json`'u tarihleri bugüne kaydırarak yükler (`src/data/demo.ts`). Aynı veri `scripts/shots.mjs` çekimlerinde de kullanılıyor.

## Apple kurallarına karşı durum

### 5.1.2(i): Veri paylaşımı ve üçüncü taraf yapay zekâ

> "You must clearly disclose where personal data will be shared with third parties, including with third-party AI, and obtain explicit permission before doing so."

| Şart | Durum |
|---|---|
| Paylaşım açıkça bildiriliyor | ✅ Onay ekranı gönderilenleri, gönderilmeyenleri ve servisleri (Google Gemini, Groq, OpenRouter) adıyla listeliyor; gönderilecek özetin tam hâli gösterilebiliyor (`ConsentPanel.tsx`). |
| Açık izin, göndermeden önce | ✅ Sohbet varsayılan kapalı; "Anladım, sohbeti aç" düğmesine basılmadan istek yok. |
| İzin geri alınabiliyor | ✅ Ayarlar'dan ve asistan ekranından; gönderim hemen durur. |
| Aracı sunucu bildiriliyor | ✅ Onay metninde Cloudflare aracı sunucusu geçiyor. |
| Servislerin veriyi saklayıp eğitimde kullanabileceği | ✅ Üç servisin notu da metnin saklanabileceğini söylüyor; Gemini notunda insan incelemesi var (`assistantModel.ts`). |
| Gizlilik politikasına uygulama içinden erişim (5.1.1(i)) | ✅ Ayarlar → Gizlilik → "Gizlilik politikası" ve onay ekranındaki bağlantı. iOS'ta Safari'de açılması beklenir (`target="_blank"`); cihazda doğrulanmalı. |

### 4.2: Asgari işlevsellik

> "Your app should include features, content, and UI that elevate it beyond a repackaged website."

| Öğe | Durum |
|---|---|
| Kendi işlevi olan uygulama, web sitesi kopyası değil | ✅ Hesaplamalar, takvim, faiz tahmini ve OCR cihazda; uygulama paketlenmiş `dist` ile tamamen çevrimdışı çalışır (canlı test için kullanılan `server.url` mağaza derlemesinde yok). |
| Yerel özellikler | ✅ Face ID kilidi, yerel son ödeme bildirimleri, dokunsal geri bildirim (Taptic Engine), paylaşım menüsü ve dosya sistemi ile yedek, kamera ve fotoğraflardan cihazda metin tanıma. |
| Face ID kilidi | ✅ Var; uygulama değiştiricide bakiyeler gizli (`src/platform/lock.ts`). |
| İlk açılış deneyimi | ✅ Boş ana ekranda "Örnek verilerle dene"; inceleyici tek dokunuşla dolu bir uygulama görür. |
| Web sürümüyle aynı arayüz | ⚠️ Aynı tasarım dili bilerek kullanılıyor (PRODUCT.md). Yerel özellikler ve çevrimdışı çalışma bunu dengeliyor; inceleme notlarında yerel özellikler ayrıca sayıldı. |

### Diğer riskli maddeler

- **3.2.1(viii) ve 5.1.1(ix), finansal hizmetler:** Bu maddeler "money management" uygulamalarının lisanslı kurumlar tarafından gönderilmesini istiyor. Kart Limitlerim bankaya bağlanmaz, hesaplara erişmez, para hareketi yapmaz ve tavsiye vermez; yalnızca kullanıcının elle girdiği verilerle bir bütçe takip aracıdır. İnceleme notlarının ilk maddesi bunu açıkça söylüyor. Ret gelirse cevap bu çerçevede yazılır.
- **4.7 ve 4.7.5, yapay zekâ sohbeti:** Sohbet bütçe konusuyla sınırlı, yatırım ve ürün önermiyor, her yanıtta "Tahmindir, finansal tavsiye değildir." ibaresi var. 18+ derecelendirme yaş kısıtlama şartını karşılar.
- **2.1, eksiksiz uygulama:** İnceleme derlemesinde sohbet çalışmalı. Şu an `npm run ios:build` aracı adresini derlemeye vermiyor; sohbet "kurulu değil" der. Bkz. Yapılacaklar.

## Yapılacaklar

Kod ya da ayar gerektiren maddeler. Koordinatör ilgili oturuma dağıtır.

1. **[iOS derlemesi, engelleyici] Mağaza derlemesinde sohbet adresi.** `ios:build` (`CAP_NATIVE=1 npm run build && cap sync ios`) `VITE_ASSISTANT_PROXY_URL` vermiyor; derlenen uygulamada sohbet "kurulu değil" der. Çözüm: `ios:build` adresi depo değişkeninden ya da `.env.production`'dan almalı (adres gizli değil: `https://kart-limitlerim-asistan.kart-limitlerim-7e48db.workers.dev`). Ayrıca `765f849` (Worker süre bütçesi ve OpenRouter yedeği) başvurudan önce `main`'e alınmalı.
2. ✅ **Uygulama içinden gizlilik politikası bağlantısı** (5.1.1(i)): Ayarlar → Gizlilik ve onay ekranı. iOS'ta bağlantının Safari'de açıldığı cihazda doğrulanmalı.
3. ✅ **Onay ekranındaki servis notları** (5.1.2(i)): `assistantModel.ts` `PROVIDERS`.
4. ✅ **Örnek verilerle deneme** (4.2): boş ana ekranda düğme; `src/data/demo.ts`.
5. **[iOS] `PrivacyInfo.xcprivacy`.** `ios/App/App/` altında yok. Apple, gerekçe isteyen API'ler (UserDefaults, dosya zaman damgası vb.) için bunu istiyor; Capacitor eklentileri (filesystem, local-notifications, haptics) bu API'leri kullanabilir. Xcode → Product → Archive sonrası "Generate Privacy Report" ile kontrol edilip eklenmeli. İzleme yok (`NSPrivacyTracking = false`), toplanan veri türleri yukarıdaki App Privacy tablosuyla aynı.
6. **[iOS] Yalnızca iPhone.** `TARGETED_DEVICE_FAMILY` projede açıkça ayarlı değil. iPad de hedeflenirse iPad ekran görüntüleri ve iPad yerleşimi gerekir. Mağaza için `TARGETED_DEVICE_FAMILY = 1` yapılmalı.
7. **[Ekran görüntüleri] Mağaza boyutlarında çekim.** `scripts/shots.mjs` şu an tasarım incelemesi için 2x çekiyor. 6.9" için 440 × 956 görüntü alanı ve 3x ölçek (1320 × 2868), 6.5" için 428 × 926 ve 3x (1284 × 2778) gerekir. Durum çubuğu ve çentik alanı olmadan, örnek verilerle, açık temada. İstenirse iPhone simülatöründen de çekilebilir.
8. **[Hesap ayarı] Yaş 18+, yalnızca Türkiye.** App Store Connect'te en düşük yaş elle 18+ ve ülke olarak yalnızca Türkiye seçilmeli (gerekçeler yukarıda).
9. ✅ **Face ID kilidi:** `src/platform/lock.ts`.
