# Gizlilik politikası

Kart Limitlerim bir bütçe uygulamasıdır. Verilerinizi toplamaz, bir sunucuya göndermez. Tek istisna, sizin açıkça açtığınız bütçe asistanı sohbetidir (aşağıda). Bu belge uygulamanın veriyi nasıl sakladığını ve sizin neleri kontrol ettiğinizi anlatır.

## Verileriniz nerede durur

- Bütün veriler yalnızca kullandığınız cihazın tarayıcı deposunda (IndexedDB) tutulur. Hesaplar, kartlar, harcamalar, kategoriler, bütçe planı, düzenli ödemeler ve kurallar bu depodadır.
- Hesap açmanız gerekmez. Uygulamanın sunucusu, kullanıcı tablosu ya da giriş sistemi yoktur.
- Uygulama analiz, izleme ya da reklam kodu içermez. Kullanım bilgisi toplanmaz.
- Banka şifresi, internet bankacılığı bilgisi, kart numarası veya CVV hiçbir zaman istenmez ve girilmemelidir.

## Ekran görüntüsü aktarma

- Seçtiğiniz ekran görüntüsü cihazınızın içinde, tarayıcıda okunur. Görüntü hiçbir sunucuya gönderilmez.
- Görüntü kaydedilmez. Okunduktan sonra yalnızca onayladığınız harcama satırları veritabanına yazılır.
- Okuma için gereken dil dosyaları uygulamanın kendi adresinden bir kez indirilir ve tarayıcı önbelleğinde saklanır. Bu indirme sırasında yalnızca uygulamanın kendi sunucusuna istek gider; üçüncü taraf sunucusu kullanılmaz.

## Bütçe asistanı

- **Öneriler** (kesime kadar nakit, yaklaşan asgari ödemeler, kategori artışları, "hangi kartla öde") tamamen cihazda hesaplanır. İnternet gerekmez, hiçbir şey gönderilmez.
- **Sohbet** varsayılan olarak kapalıdır. Açmadan önce hangi bilgilerin hangi servislere gideceğini gösteren bir onay ekranı çıkar; onay vermeden hiçbir şey gönderilmez.
- Sohbet açıksa her mesajda şunlar gönderilir: cihazda hesaplanan bir **özet** (harcama gücü toplamları, kesime kadar görünüm, hesap adlarınız ve limit/bakiye/ekstre tutarları, kategori toplamları, bütçe planınız ve bu ayki harcama gidişatı, cihazdaki öneriler) ve yazdığınız mesajlar. Tek tek harcamalar, notlar, düzenli ödeme adları ve yedek dosyası **gönderilmez**. Gönderilen özetin tam hâlini onay ekranında görebilirsiniz.
- Özet önce projenin Cloudflare Workers üzerindeki aracı sunucusuna gider. Aracı yalnızca yapay zekâ servislerinin anahtarlarını tutar; istekleri kaydetmez ve günlüğe yazmaz. Kötüye kullanımı önlemek için IP adresiniz yalnızca bellekte, en çok bir saat boyunca istek saymak için kullanılır.
- Aracı isteği sırasıyla şu ücretsiz yapay zekâ servislerinden birine iletir: Google Gemini, Groq, OpenRouter. Bu servislerin ücretsiz katmanları gönderilen metni kendi koşullarına göre saklayabilir ve modellerini geliştirmek için kullanabilir. Bu nedenle sohbete kimlik, kart numarası ya da şifre yazmayın.
- Sohbet geçmişi yalnızca açık olan ekranda, bellekte tutulur; kaydedilmez.
- Onayınızı Ayarlar'dan ya da asistan ekranından istediğiniz an geri alabilirsiniz. Geri aldığınızda gönderim hemen durur. Onay bilgisi tarayıcının yerel deposunda (`localStorage`) tutulur.
- Yanıtlar tahmindir, finansal tavsiye değildir. Rakamların kaynağı uygulamanın kendi hesaplarıdır; banka ekstresi esastır.

## Yedek dosyaları

- "Yedeği indir" düğmesi tüm verilerinizi düz bir JSON dosyası olarak indirir. Dosya tarayıcınızın indirme klasörüne kaydedilir.
- Dosyayı nerede saklayacağınıza, kimle paylaşacağınıza siz karar verirsiniz. Uygulama yedeği hiçbir yere yüklemez.
- Yedek dosyasında banka şifresi bulunmaz; ama kart limitleriniz, harcamalarınız ve ekstre bilgileriniz açıktır. Dosyayı güvenli bir yerde tutun.
- "Yedekten geri yükle" cihazdaki bütün verileri dosyadakilerle değiştirir. Bu işlem onay ister.

## Verilerinizi silme

- Ayarlar → Tehlikeli bölge → **Tüm verileri sil** düğmesi bu cihazdaki bütün verileri (hesaplar, harcamalar, kategoriler, düzenli ödemeler, kurallar) siler ve varsayılan kategorileri yeniden yükler. İşlem iki adımlı onay ister ve geri alınamaz.
- Tarayıcının bu site için sakladığı verileri temizlemek de uygulama verilerini siler. Bunu yapmadan önce yedek alın.
- Sunucuda silinecek bir kopya olmadığı için silme talebi göndermeniz gerekmez.

## KVKK

Uygulama kişisel veri toplamaz ve kendi sunucusunda saklamaz. Bütçe asistanı sohbetini açarsanız, onay ekranında gösterilen özet ve mesajlarınız yanıt üretmek için yukarıda adı geçen servislere aktarılır (6698 sayılı KVKK kapsamında açık rızanızla ve yurt dışına aktarım dahil). Sohbeti açmazsanız hiçbir kişisel veri cihaz dışına çıkmaz.

## Değişiklikler

Bu politika uygulamanın veri davranışı değiştiğinde güncellenir. Güncel sürüm her zaman bu dosyadadır.
