# Gizlilik politikası

Kart Limitlerim bir bütçe uygulamasıdır. Verilerinizi toplamaz, bir sunucuya göndermez. Bu belge uygulamanın veriyi nasıl sakladığını ve sizin neleri kontrol ettiğinizi anlatır.

## Verileriniz nerede durur

- Bütün veriler yalnızca kullandığınız cihazın tarayıcı deposunda (IndexedDB) tutulur. Hesaplar, kartlar, harcamalar, kategoriler, düzenli ödemeler ve kurallar bu depodadır.
- Hesap açmanız gerekmez. Uygulamanın sunucusu, kullanıcı tablosu ya da giriş sistemi yoktur.
- Uygulama analiz, izleme ya da reklam kodu içermez. Kullanım bilgisi toplanmaz.
- Banka şifresi, internet bankacılığı bilgisi, kart numarası veya CVV hiçbir zaman istenmez ve girilmemelidir.

## Ekran görüntüsü aktarma

- Seçtiğiniz ekran görüntüsü cihazınızın içinde, tarayıcıda okunur. Görüntü hiçbir sunucuya gönderilmez.
- Görüntü kaydedilmez. Okunduktan sonra yalnızca onayladığınız harcama satırları veritabanına yazılır.
- Okuma için gereken dil dosyaları uygulamanın kendi adresinden bir kez indirilir ve tarayıcı önbelleğinde saklanır. Bu indirme sırasında yalnızca uygulamanın kendi sunucusuna istek gider; üçüncü taraf sunucusu kullanılmaz.

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

Uygulama kişisel veri toplamadığı ve bir sunucuda işlemediği için, 6698 sayılı KVKK kapsamında sunucuda işlenen bir kişisel veri bulunmamaktadır.

## Değişiklikler

Bu politika uygulamanın veri davranışı değiştiğinde güncellenir. Güncel sürüm her zaman bu dosyadadır.
