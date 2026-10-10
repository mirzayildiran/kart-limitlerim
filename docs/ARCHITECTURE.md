# Mimari

Bu belge kodun nasıl düzenlendiğini, verinin nereden nereye aktığını ve iki hesabın (faiz, OCR) nasıl yapıldığını anlatır. Ürün davranışı için [README](../README.md), plan için [yol haritası](ROADMAP.md).

## Klasörler

| Yol | Sorumluluk |
|---|---|
| `src/domain/` | Saf iş mantığı: para, tarih, ekstre dönemi, harcama gücü, faiz, oranlar, düzenli ödemeler. UI ve tarayıcı API'si yok. Her dosyanın `*.test.ts` dosyası var. |
| `src/data/` | `db.ts` IndexedDB şeması ve işlemleri, `backup.ts` yedek biçimi ve doğrulama, `store.ts` uygulama durumu ve eylemler. |
| `src/ocr/` | Ekran görüntüsünden harcama okuma: önişleme, Tesseract motoru, ikinci okuma, banka ayrıştırıcıları, kategori önerisi. |
| `src/ai/` | Bütçe asistanı sağlayıcı katmanı: aracıyla konuşma sözleşmesi (`protocol.ts`), istek doğrulama, sistem istemi, tarayıcı istemcisi. |
| `worker/assistant-proxy/` | Cloudflare Worker: yapay zekâ anahtarlarını tutan aracı sunucu. |
| `src/ui/` | Tasarım sistemi: `tokens.css` (renkler, boşluklar), `base.css`, `components/` (Sheet, Button, MoneyField, LimitStrip, TabBar…), `nav.ts` (sayfa ve pencere durumu), `theme.ts`. |
| `src/features/` | Ekranlar. `home/`, `accounts/`, `expenses/`, `statements/`, `calendar/`, `recurring/`, `categories/`, `settings/`, `import/`. `SheetHost.tsx` açık pencereyi gösterir. |
| `scripts/` | `copy-ocr-assets.mjs` (OCR dosyalarını `public/ocr/` içine kopyalar, `predev` ve `prebuild` sırasında çalışır), `check-css.mjs` (renk kontrolü, `lint` içinde), `ocr-smoke.mjs` (Node'da OCR denemesi; test ve CI'da değil). |
| `public/` | İkonlar ve favicon. `public/ocr/` derlemede üretilir ve git'e girmez. |
| `.github/workflows/` | `ci.yml` (her gönderimde kontrol), `deploy.yml` (`main` dalında GitHub Pages yayını). |
| `vite.config.ts` | Derleme, PWA manifesti ve önbellek kuralları, test ayarı. |
| `eslint.config.js` | Lint kuralları (aşağıda kalite kapısı). |

Bağımlılık yönü tek yönlüdür: `features` ve `ui` `data`, `ocr` ve `domain` modüllerini kullanır. `domain` yalnızca kendi modüllerini içe aktarır; UI ya da veri katmanına bağlı değildir. `ocr` yalnızca `domain`'in para, tarih ve kategori tanımlarını kullanır.

## Veri akışı

Durum `src/data/store.ts` içinde Preact sinyalleridir: `accounts`, `expenses`, `categories`, `recurring`, `rules`, `today`. Türetilmiş değerler (`cards`, `power`, `statements`, `forecast`) `computed` olarak hesaplanır. Bileşenler sinyalleri okur; veri yalnızca store'daki eylemlerle değişir (`saveAccount`, `saveExpense`, `importExpenses`, `saveRecurring`…). Bileşen IndexedDB'ye doğrudan dokunmaz.

Harcama kaydetme yolu:

1. Form `saveExpense(önceki, yeni)` çağırır.
2. `repo.writeExpense` tek bir IndexedDB işleminde (`expenses` ve `accounts` mağazaları) hem harcamayı yazar hem etkilenen hesabın `available` ya da `balance` alanını değiştirir. Harcama silinince ya da değişince fark (`expenseDeltas`) uygulanır.
3. İşlem başarılı olunca sinyaller güncellenir (`expenses` ve değişen hesaplar). İşlem hata verirse sinyaller değişmez; ekranda eski ve kayıtlı veri arasında fark oluşmaz.

Ekran görüntüsü aktarmada aynı kural geçerlidir: `importExpenses` bütün seçili satırları ve hesap güncellemelerini tek işlemde yazar.

Açılış sırası (`init`): veritabanını aç (ilk açılışta varsayılan kategorileri yaz), bütün mağazaları yükle, kesimi geçmiş satırlar için `closeCycle` çalıştır, sonra `ready` yap. Gün değişince (`visibilitychange`, `focus`) `today` yenilenir ve kesim kontrolü tekrarlanır.

Veritabanı: IndexedDB, ad `kart-limitlerim`, sürüm 1. Mağazalar: `accounts`, `expenses` (dizinler `byDate`, `byAccount`), `categories`, `recurring`, `rules`, `meta`. `meta` anahtar–değer deposudur; bugün yalnızca `budgets` anahtarında bütçe planını (`CategoryBudget[]`: kategori başına aylık hedef) tutar. Bu sayede plan için veritabanı sürümü değişmedi. Uygulama `navigator.storage.persist()` ile tarayıcıdan verinin silinmemesini ister.

Tema tercihi tek başına `localStorage` içinde (`kl:theme`) tutulur. Bu, veri değildir.

## Yedek

- Dışa aktarma: bütün mağazalar okunur ve `{ app: 'kart-limitlerim', schema: 1, exportedAt, data }` biçiminde JSON olarak indirilir. Dosya adı `kart-limitlerim-yedek-YYYY-AA-GG.json`.
- Bütçe planı yedekte isteğe bağlı `data.budgets` alanıdır; bu alan olmayan eski yedekler boş planla açılır.
- İçe aktarma: önce `parseBackup` dosyayı doğrular (uygulama adı, şema sürümü, beş listenin varlığı ve her kaydın `id`'si). Doğrulama geçerse kullanıcı onaylar, sonra `restoreBackup` beş mağazayı tek işlemde temizleyip yeniden yazar. Yarım kalan geri yükleme olmaz.
- Şema sürümü 1 dışındaki yedekler reddedilir. Daha yeni bir sürümden alınmış yedek için uygulamanın güncellenmesi istenir.
- Yedek hiçbir yere gönderilmez; kullanıcı dosyayı kendisi saklar.

## Bütçe asistanı

İki katman var:

1. **Öneriler** (`src/domain/insights.ts`): kurala dayalıdır, cihazda çalışır, ağa çıkmaz. Bütçe planı hedefinin aşılması ya da bu hızla aşılacak olması, ayın geçen aydan pahalı gitmesi, kesime kadar nakit açığı, yaklaşan ve geciken asgari ödemeler, limiti azalan kart ya da KMH, KMH günlük faizi, asgari ödeme faizi, kategori artışı (bu ayın ilk N günü ile geçen ayın aynı günleri) ve "bugün hangi kartla öde" (bugünkü alışverişin son ödemesine en uzun süre kalan kart). Tutarlar `power.ts`, `interest.ts` ve `statement.ts` hesaplarından gelir.
2. **Sohbet** (`src/features/assistant/`, `src/ai/`, `worker/assistant-proxy/`): varsayılan kapalıdır. Kullanıcı onay ekranında gönderilecek özeti görüp kabul edince açılır; onay `localStorage`'da (`kl:assistant-consent`, sürümlü) tutulur.

Sohbet akışı:

1. `budgetSummary` (`src/domain/insightsSummary.ts`) toplamları, hesap adlarını, ekstre rakamlarını, kategori karşılaştırmasını ve önerileri hazır biçimlenmiş metinler olarak bir özet nesnesine koyar. Tek tek harcama, not, kimlik ve düzenli ödeme adı girmez.
2. `askAssistant` (`src/ai/client.ts`) özeti ve son 12 mesajı aracıya gönderir (30 sn zaman aşımı). Aracının adresi derleme sırasında `VITE_ASSISTANT_PROXY_URL` ile verilir; yoksa sohbet kapalıdır.
3. Worker kaynağı (`ALLOWED_ORIGINS`; iOS için `capacitor://localhost`, canlı testte özel ağdaki `http://…:5173` için `LAN_DEV_PORT`), boyutu ve biçimi (`parseAssistantRequest`) denetler, IP başına hız sınırı uygular, sistem istemini (`SYSTEM_PROMPT`) ve özeti ekleyip Gemini, Groq ve OpenRouter'ı bu sırayla dener. İstek içeriği günlüğe yazılmaz.
4. Model yalnızca özetteki rakamları kullanır; yeni hesap yapmaz. Her yanıtın altına "Tahmindir, finansal tavsiye değildir." ibaresini uygulama ekler.

Sohbet geçmişi yalnızca bellekte tutulur. Worker, `main` dalına her gönderimde `deploy.yml` içindeki `scripts/deploy-assistant.sh` ile kurulur (depo gizli değerleri: `CLOUDFLARE_API_TOKEN`, `GEMINI_API_KEY`, `GROQ_API_KEY`, isteğe bağlı `OPENROUTER_API_KEY`).

## Para ve tarih kuralları

- **Para:** Her tutar tam sayı kuruştur (`Kurus` tipi; 1 ₺ = 100). Lira değeri yalnızca girişte ve ekranda görünür. Girişte `parseTL` ("1.234,56", "₺1.234 TL" gibi metinleri kabul eder), ekranda `formatTL` (tam lira) ya da `formatTLExact` (kuruşlu). `toFixed` ve elle biçimlendirme kullanılmaz.
- **Oranlar:** Yüzde olarak tutulur (`3.25` = aylık %3,25). Günlük oran aylık oran / 30 ile bulunur.
- **Tarih:** Yerel takvim günüdür ve `YYYY-MM-DD` metni olarak saklanır (`IsoDate`). `fromIso` ve `toIso` bu dönüşümü yapar. `daysBetween` gün farkını UTC üzerinden hesaplar; yaz saati geçişi sonucu bozmaz.
- **Ekstre dönemi:** `CycleKey` (`YYYY-MM`) ekstrenin kesim ayıdır. Kesim günü 31 ise kısa aylarda ayın son günü kullanılır.
- **Son ödeme:** Kesen tarih ile kesim sonrası gün sayısından (`dueOffsetDays`) bulunur; cumartesi ya da pazara denk gelirse pazartesiye kayar. Resmi tatiller hesaba katılmaz. Kullanıcı ekstredeki kesin tarihi girerse o kullanılır.

## Domain modülleri

| Dosya | İçerik |
|---|---|
| `money.ts` | Kuruş dönüşümü, `parseTL`, `formatTL`, `formatTLExact`, `formatInput`. |
| `dates.ts` | Yerel gün, ISO dönüşümü, gün farkı, ay sınırı, hafta sonu kayması, Türkçe biçimler. |
| `statement.ts` | `lastCut` ve `nextCut`, `viewStatement` (bir kartın bugünkü ekstre görünümü), `rollToCurrentCycle`. Eski döneme ait alanlar yeni kesimde sıfırlanır. |
| `power.ts` | `spendingPower` (kartlar + KMH + nakit), `byMostAvailable` (boş limite göre sıralama), `statementItems` (asgari ödeme listesi), `outlook` (kesime kadar ve ödemelerden sonra nakit). |
| `ledger.ts` | `applyDelta` ve `expenseDeltas`: harcamanın hesaba etkisi. |
| `recurring.ts` | `occurrences`: düzenli ödemenin belirli aralıktaki tahsilat tarihleri. |
| `rates.ts` | TCMB azami faiz tablosu (1 Ekim 2026), kart kademeleri, KMH ve nakit oranı, KKDF/BSMV, BDDK asgari ödeme kuralı. |
| `interest.ts` | Faiz hesabı, kart oranı seçimi, günlük maliyet, dönem kapatma, toplam işleyen faiz. |
| `categories.ts` | Başlangıç kategorileri ve yeni kategori rengi. |
| `budget.ts` | Ay gidişatı (`monthPace`: bu ay, geçen ayın aynı günleri, tahmini ay sonu) ve kategori hedefi ilerlemesi (`budgetProgress`). |
| `insights.ts`, `insightsSummary.ts` | Bütçe asistanının kurala dayalı önerileri ve modele giden özet. |

Harcama gücü ve kesime kadar sayıları `power.ts` içinde hesaplanır; ekran yalnızca bunları gösterir.

Kart taksitli harcamanın tamamı, taksit sayısından bağımsız olarak, satın alındığı anda kartın kullanılabilir limitinden düşer. `ledger.ts` yorumuna göre bu, Türk bankalarının uyguladığı yöntemdir.

## Faiz motoru

Girdiler: borç `D` (ekstre borcu), asgari `M`, ödenen `P`, kesim `C`, son ödeme `U`, sonraki kesim `N`, akdi oran `a` (%), gecikme oranı `g` (%).

- `P ≥ D` ise faiz sıfırdır.
- Birinci dönem (C → U, `d1` gün): `(D − P) × a / 100 / 30 × d1`.
- İkinci dönem (U → N, `d2` gün):
  - gecikme faizi: `max(0, M − P) × g / 100 / 30 × d2`
  - akdi faiz: kalan borç `(D − P − max(0, M − P)) × a / 100 / 30 × d2`
- Vergi öncesi toplam: birinci dönem akdi faizi + ikinci dönem akdi faizi + gecikme faizi. Her bileşen ayrı yuvarlanır.
- Vergiler vergi öncesi toplam üzerinden: KKDF %15 ve BSMV %15, her biri ayrı yuvarlanır.
- Toplam = vergi öncesi + KKDF + BSMV.

Örnek (`interest.test.ts`): `D` = 1.000 ₺, `M` = 400 ₺, `a` = %3,5, `g` = %3,8, `d1` = 10, `d2` = 20.

| Ödenen `P` | Akdi faiz | Gecikme faizi | Vergi öncesi toplam |
|---|---|---|---|
| 400 ₺ | 21,00 ₺ | 0 | **21,00 ₺** |
| 100 ₺ | 24,50 ₺ | 7,60 ₺ | **32,10 ₺** |
| 0 ₺ | 25,67 ₺ | 10,13 ₺ | **35,80 ₺** |

Bu üç değer, `interest.test.ts` içindeki üç banka örneğinin beklenen çıktılarıdır. Tutar 32,10 ₺ için vergiler 4,82 ₺ + 4,82 ₺ olup toplam 41,74 ₺ eder.

Ek hesaplar:

- **Kart oranı:** Kart üzerinde elle girilen oran (`rateOverride`) varsa o kullanılır. Yoksa TCMB kademesi seçilir: ekstre borcu 30.000 ₺ altındaysa %3,25 / %3,55 (akdi / gecikme), 30.000–180.000 ₺ arasındaysa %3,75 / %4,05, 180.000 ₺ üstündeyse %4,25 / %4,55.
- **Günlük maliyet (kart):** taşınan borç × akdi oran / 100 / 30 × 1,30. Çarpan vergileri (%15 + %15) içerir.
- **KMH günlük maliyeti:** kullanılan limit × oran / 100 / 30 × 1,30. Oran, elle girilmemişse nakit çekme oranıdır (%4,25).
- **Dönem kapatma (`closeCycle`):** kesim geçtiyse eski dönemin faizi `interestHistory`'ye bir kez yazılır. Kullanıcı ekstredeki faizi girdiyse o kullanılır, girmediyse tahmin edilir. Tamamı ödenmiş dönemde kayıt yazılmaz.
- **Toplam işleyen faiz:** Geçmiş kayıtların toplamı artı her kartın mevcut ekstresinin "girildiği gibi" (`asEntered`) tahmini. Ekstre tutarı bilinmeyen kartlar toplamdan çıkarılır; hiçbiri bilinmiyorsa sonuç yoktur.

## OCR hattı

Ekran görüntüsü cihazda, beş aşamada okunur. Her aşama bir dosyada.

1. **Önişleme** (`preprocess.ts`): Görüntü `createImageBitmap` ile çözülür. Gri tona çevrilir (Rec. 601 parlaklık). Medyan parlaklık 0,5'in altındaysa (koyu tema) renkler tersine çevrilir. Genişlik 1400 px'in altındaysa iki kat büyütülür. Analiz orijinal boyutta yapılır, yalnızca son tuval büyütülür.
2. **Birinci okuma** (`engine.ts`): Tesseract.js, Türkçe `tur` dili, yalnızca LSTM modu. Sayfa bölütleme modu PSM 11 (seyrek metin): banka listesi sütunlardan oluştuğu için her kelime olduğu yerde okunur. Kelime kutuları orijinal piksel koordinatlarına çevrilir. Tesseract tek bir worker'da çalışır; worker uygulama boyunca yeniden kullanılır ve içe aktarma ekranı kapanınca serbest bırakılır.
3. **Tarih sütunu ikinci okuması** (`merge.ts`): Birinci okumada en az üç tutar benzeri kelime (`\d+[.,]\d{2}`) bulunursa sol %17'lik şerit tek blok modunda (PSM 6) ve yalnızca rakam ile tarih harfleri izin verilerek yeniden okunur. Yeni kelimelerden birinci okumadaki kelimelerle IoU'su 0,3'ü aşmayanlar eklenir. Ayar her durumda birinci okuma değerlerine geri alınır. Büyük, tek başına duran gün sayıları PSM 11'de kaçtığı için bu adım vardır.
4. **Ayrıştırma** (`parse.ts`): Banka profili, metindeki ipuçlarından seçilir (`detectProfile`): Ziraat Bankkart, Ziraat Dinamik, Akbank, İş Bankası, Garanti; diğerleri `generic`. Kelimeler satırlara y konumuyla gruplanır. Tutar içeren satırlar bir satırın başlangıcı sayılır; yakındaki tarih blokları ve açıklama satırları bu satıra bağlanır. "Toplam", "Bekleyen" gibi başlık satırları ve transfer satırları atlanır. "BEKLEMEDE" bölümündeki satırlar `pending` olarak işaretlenir. Taksit bilgisi ("3/6 taksit", "(X TL işlemin)") satır grubunda aranır. Ödeme ve iade satırları `credit` olur. Garanti'de ilk parça banka kategorisidir.
   Her satır için güven puanı: tarih yoksa −0,3, tarih ay ya da yılı önceki satırdan alındıysa −0,2, kelime güveni ortalaması 70'in altındaysa −0,2, açıklama boşsa −0,2.
5. **Gözden geçirme** (`importModel.ts`, `ImportSheet.tsx`): Yalnızca borç satırları gösterilir. Varsayılan olarak seçili olanlar: borç, tarihi okunmuş, güveni 0,5 ya da üstü ve mükerrer olmayan (aynı hesap, tarih ve tutar). Kategori önerisi sırayla şöyle bulunur: öğrenilmiş kural, banka kategorisi, anahtar kelime tablosu, "Diğer". Kullanıcı önerisi değiştirirse merchant anahtarı için kural öğrenilir. Kayıt `importExpenses` ile tek işlemde yazılır.

Ekran görüntüsü kaydedilmez. Ayrıştırmanın ham metni (`ParsedTxn.raw`) yalnızca bellekte tutulur; veritabanına yazılmaz.

## PWA ve önbellek

- `vite-plugin-pwa` ile manifest ve service worker üretilir. Güncelleme `registerType: 'prompt'` ile çalışır: yeni sürüm hazır olduğunda "Yenile" düğmeli bir bildirim çıkar.
- Workbox ön önbelleğe alma (precache) JS, CSS, HTML, SVG, PNG ve WOFF2 dosyalarını kapsar. `ocr/` klasörü bu kapsamın dışındadır; OCR dosyaları ilk kurulumda indirilmez.
- OCR dosyaları (worker betiği, çekirdek dosyaları, Türkçe dil verisi) ilk OCR kullanımında `ocr-assets` adlı önbelleğe `CacheFirst` ile alınır (en çok 20 kayıt, 365 gün). Bu nedenle OCR'ı ilk kez kullanmak çevrim içi bağlantı ister; sonraki kullanımlar çevrim dışıdır.
- OCR dosyaları uygulamanın kendi host'undan gelir (`public/ocr/`, derleme sırasında kopyalanır). Çalışma zamanında CDN kullanılmaz.
- Sayfa adresleri `index.html`'e yönlendirilir (`navigateFallback`).

## Kalite kapısı

| Kontrol | Komut | Yer |
|---|---|---|
| Tip denetimi | `npm run typecheck` (`tsc -b`) | CI |
| Lint | `npm run lint` (ESLint ve `scripts/check-css.mjs`) | CI ve yayın |
| Test | `npm test` (`vitest run`) | CI ve yayın |
| Derleme | `npm run build` (`tsc -b` ve `vite build`; önce OCR dosyaları kopyalanır) | CI ve yayın |

- **CI** (`ci.yml`): `pull_request` ve `main` dalına gönderimde çalışır: `typecheck`, `lint`, `test`, `build`.
- **Yayın** (`deploy.yml`): `main` dalına gönderimde ve elle tetiklemede çalışır. Önce `test`, `lint` ve `build`; ardından `dist/` GitHub Pages'e yüklenir. Aynı anda tek yayın çalışır (`concurrency: pages`).

Lint kuralları:

- `check-css.mjs`: `src/ui/tokens.css` dışında ham `#hex`, `rgb(`, `hsl(` yasaktır. Bilerek gereken satır `/* allow-color */` ile işaretlenir.
- ESLint: `any` yasak. `@ts-ignore` ve `@ts-nocheck` yasak; `@ts-expect-error` yalnızca açıklamayla. `alert`, `confirm`, `prompt` yasak. Sinyal dizisi üzerinde yerinde `sort`, `reverse`, `splice` yasak (`[...x.value].sort()` kullan). Kullanılmayan değişkenler hata verir; `_` ile başlayan argümanlar istisnadır.
- Erişilebilirlik: `alt` metni zorunlu, geçersiz bağlantı yasak; tıklanabilir öğe için klavye olayı uyarısı.
