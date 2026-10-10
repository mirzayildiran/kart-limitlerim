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

## Verileri Safari'deki PWA'dan taşıma

Uygulama farklı bir adreste (`capacitor://localhost`) çalıştığı için PWA'daki veriler otomatik gelmez.
PWA'da Ayarlar → Yedek → indir; uygulamada Ayarlar → Yedekten geri yükle.

## App Store yolu

| Adım | Gerekli |
| --- | --- |
| Kendi iPhone'unda test | Ücretsiz Apple ID (kurulum 7 gün geçerli, sonra yeniden Run) |
| TestFlight ve App Store | Apple Developer Program, yıllık 99 USD |

Mağazaya göndermeden önce: gizlilik politikası adresi (`docs/PRIVACY.md` yayında olmalı),
App Store gizlilik etiketleri, 6.9" iPhone ekran görüntüleri, `PrivacyInfo.xcprivacy`,
ve uygulamanın "web sitesini saran uygulama" sayılmaması için yerel özellikler
(Face ID kilidi, son ödeme bildirimleri, dokunsal geri bildirim).
