# iPhone'da test ve App Store

Uygulama Capacitor ile yerel bir iOS uygulamasına sarılır (`ios/`). Web kodu aynıdır;
iPhone'da Safari yerine uygulamanın kendi WKWebView'ı çalıştırır.

## Bir kerelik kurulum

1. **Xcode**: Mac App Store'dan kur, bir kez aç (ek bileşenleri ve iOS platformunu indirir). Sonra Terminal'de:
   ```bash
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   ```
2. **Apple hesabı**: Xcode → Settings → Accounts → `+` → Apple ID ile giriş.
3. **Projeyi aç**: `npm run ios:open`. Sol üstte *App* hedefi → *Signing & Capabilities* → *Team* olarak kendi hesabını seç.
   Bundle ID `com.mirzayildiran.kartlimitlerim`; App Store Connect'te kayıt açılınca değiştirilemez.
4. **iPhone**: kabloyla Mac'e bağla, "Bu bilgisayara güven" de.
   Ayarlar → Gizlilik ve Güvenlik → **Geliştirici Modu**'nu aç (telefon yeniden başlar).
5. Xcode'da üstteki cihaz menüsünden iPhone'unu seç, **Run (⌘R)**.
   Ücretsiz hesapta ilk açılışta: Ayarlar → Genel → VPN ve Cihaz Yönetimi → geliştiriciye güven.
6. İsteğe bağlı: Xcode → Window → Devices and Simulators → iPhone'un → **Connect via network**.
   Bundan sonra kablo gerekmez.

## Günlük canlı test

```bash
npm run ios:dev
```

Mac'teki Vite sunucusunu Wi-Fi'a açar ve uygulamayı ona yönlendirir. Xcode'da bir kez Run'a bas;
sonra kaydettiğin her değişiklik telefonda anında yenilenir. Mac ve iPhone aynı Wi-Fi'da olmalı.
İlk açılışta iPhone "yerel ağdaki aygıtları bulma" izni sorar: **İzin Ver**.
macOS güvenlik duvarı açıksa Node'a gelen bağlantılara izin ver.

Xcode bağlıysa tek komut: `npm run ios:dev -- --run`.

## Paketlenmiş sürüm (Wi-Fi'sız, mağazadaki gibi)

```bash
npm run ios:build
```

Sonra Xcode'da Run. `ios:dev` sonrası bu komut çalıştırılmadan yapılan sürüm Mac'e bağlı kalır.

## Yalnızca uygulamada olanlar

Ayarlar → **Bu iPhone** (tarayıcıda görünmez):

- **Face ID ile kilitle**: uygulama arka plana geçince kilitlenir, dönüşte Face ID ya da cihaz şifresi ister.
  Uygulama değiştiricide içerik örtülür.
- **Son ödeme hatırlatması**: ödenmemiş her ekstre için iki gün önce ve son gün 10:00'da bildirim.
  Kilit ekranında görüneceği için tutar yazmaz. Ekstreyi ödendi işaretleyince hatırlatmalar silinir.

Yedek indirme uygulamada paylaşım menüsünü açar (Dosyalar'a kaydet, AirDrop). Kart kaydırırken ve filtre seçerken hafif titreşim olur.

## Verileri Safari'deki PWA'dan taşıma

Uygulama farklı bir adreste (`capacitor://localhost`) çalıştığı için PWA'daki veriler otomatik gelmez.
PWA'da Ayarlar → Yedek → indir; uygulamada Ayarlar → Yedekten geri yükle.

## App Store yolu

| Adım | Gerekli |
| --- | --- |
| Kendi iPhone'unda test | Ücretsiz Apple ID (kurulum 7 gün geçerli, sonra yeniden Run) |
| TestFlight ve App Store | Apple Developer Program, yıllık 99 USD |

Şu an ücretsiz hesapla ilerliyoruz. Bu hesabın sınırları:

- Telefondaki kurulum 7 günde süresi dolar; Xcode'da yeniden Run yeterli, veriler kalır.
- Aynı anda en çok 3 uygulama, haftada en çok 10 yeni Bundle ID.
- Çalışır: Face ID, yerel bildirimler (son ödeme hatırlatma), dokunsal geri bildirim, Anahtar Zinciri, paylaşım menüsü.
- Çalışmaz: uzaktan push bildirimi, App Groups (ana ekran widget'ı buna bağlı), iCloud, TestFlight.
  Bu yüzden widget ücretli üyeliğe kadar bekler; ücretli hesaba geçince Bundle ID ve kod aynı kalır.

Mağazaya göndermeden önce: gizlilik politikası adresi (`docs/PRIVACY.md` yayında olmalı),
App Store gizlilik etiketleri, 6.9" iPhone ekran görüntüleri, `PrivacyInfo.xcprivacy`,
ve uygulamanın "web sitesini saran uygulama" sayılmaması için yerel özellikler
(Face ID kilidi, son ödeme bildirimleri, dokunsal geri bildirim).
