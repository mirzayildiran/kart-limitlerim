<p align="center">
  <img src="public/icons/icon-192.png" width="96" height="96" alt="Kart Limitlerim simgesi">
</p>

<h1 align="center">Kart Limitlerim</h1>

<p align="center">
  Kredi kartlarındaki ve KMH'deki boş limitten <b>şu an gerçekte ne kadar harcayabileceğini</b> gösteren bütçe uygulaması.
</p>

<p align="center">
  <a href="https://github.com/mirzayildiran/kart-limitlerim/actions/workflows/ci.yml"><img src="https://github.com/mirzayildiran/kart-limitlerim/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/mirzayildiran/kart-limitlerim/actions/workflows/deploy.yml"><img src="https://github.com/mirzayildiran/kart-limitlerim/actions/workflows/deploy.yml/badge.svg" alt="Deploy"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/lisans-MIT-0D7755" alt="Lisans: MIT"></a>
</p>

<p align="center">
  <a href="https://mirzayildiran.github.io/kart-limitlerim/">Canlı sürüm</a>
</p>

---

## Neden?

Bütçe uygulamalarının çoğu "ne kadar borcun var" sorusunu cevaplar. Kart Limitlerim tersinden bakar:

- **Harcama gücü:** Bütün kartlardaki boş limit, KMH'deki boş limit ve nakit tek rakamda.
- **İleriye bakış:** Asgari ödemeler ve düzenli ödemeler çıktıktan sonra bir sonraki kesime kadar elinde ne kalacağı.
- **Faiz tahmini:** Kesimden sonra yalnızca asgariyi ödersen gelecek ekstrede ne kadar faiz çıkacağı (akdi faiz, KKDF, BSMV dahil).
- **Ekran görüntüsünden aktarma:** Banka uygulamasının ekran görüntüsünü at, harcamalar telefonda okunup listeye eklensin. Görüntü hiçbir sunucuya gitmez.

## Özellikler

| Durum | Özellik |
|:-:|---|
| ✅ | Kartlar, KMH, nakit ve hesaplar; kullanılabilir limite göre sıralı |
| ✅ | Kesim ve son ödeme takvimi, asgari ödeme takibi |
| ✅ | Harcamalar, kendi oluşturduğun kategoriler ve taksitli harcamalar |
| ✅ | Düzenli ödemeler ve takvim |
| ✅ | Faiz tahmini: kesimden sonraki faiz ve kart başına toplam işleyen faiz |
| ✅ | Ekran görüntüsünden harcama aktarma (cihaz üzerinde OCR) |
| ✅ | Yedek alma ve geri yükleme (JSON) |
| ✅ | Açık ve koyu tema |
| ⏳ | App Store ve Google Play sürümleri |

Ayrıntılı plan için [yol haritasına](docs/ROADMAP.md) bak.

## Nasıl çalışır

- **Harcama gücü:** Kartlardaki, KMH'deki ve nakit hesaplardaki kullanılabilir tutarların toplamı. Kart ve KMH için kullanılabilir tutar boş limittir. Ana ekranda "Şu an harcayabileceğin" altında gösterilen tutar budur.
- **Kesime kadar:** Harcama gücünden, bugünden bir sonraki ekstre kesimine kadar çıkacak düzenli ödemeler düşülür. Kalan tutar, o tarihe kadar harcayabileceğin miktardır.
- **Ödemelerden sonra nakit:** Nakit, banka bakiyesi ve boş KMH'den; kesime kadar vadesi gelen asgari ödemeler ve nakitten çekilecek düzenli ödemeler düşülür. Eksi çıkarsa ekranda ne kadar eksik olduğu yazar. Kartın asgarisini ödemek harcama gücünü değiştirmez, nakdi azaltır.

## Ekran görüntüsünden aktarma

Banka uygulamasındaki harcama listesinin ekran görüntüsünü seçersin. Okuma telefonda, tarayıcının içinde yapılır. Görüntü hiçbir yere gönderilmez ve saklanmaz.

Tanınan bankalar:

- Ziraat Dinamik
- Ziraat Bankkart
- Akbank
- İş Bankası
- Garanti

Tanınmayan düzenler de genel bir okuyucuyla denenir; bu durumda satırları daha dikkatli kontrol et.

Okuma sonrası her satır onay ekranında görünür. Ödeme ve iade satırları harcama olarak alınmaz. Aktarılan harcamalar varsayılan olarak kullanılabilir limiti düşürmez, çünkü banka uygulaması limiti zaten düşmüş gösterir. Limiti az önce güncellediysen de kapalı bırak. Gerekirse onay ekranındaki **Kullanılabilir limitten de düş** anahtarını aç.

Gerçek ekran görüntüleriyle yapılan ölçümde beş bankada 29 satırın 28'i doğru okundu. Yine de her satırı kaydetmeden önce kontrol et.

## Gizlilik

- Bütün veriler **yalnızca senin cihazında** (IndexedDB) saklanır. Hesap, sunucu ya da takip kodu yok.
- Banka şifresi veya kart numarası **hiçbir zaman istenmez**.
- Ekran görüntüleri cihazda okunur ve okunduktan sonra saklanmaz.

Ayrıntılar için [gizlilik politikasına](docs/PRIVACY.md) bak.

## Geliştirme

Gereksinim: Node.js 22+

```bash
npm install
npm run dev        # geliştirme sunucusu
npm run lint       # ESLint ve CSS renk kontrolü
npm test           # birim testleri (Vitest)
npm run build      # üretim derlemesi (dist/)
```

`main` dalına yapılan her gönderim testlerden ve lint kontrolünden geçtikten sonra GitHub Pages'e otomatik yayınlanır.

### Teknoloji

[Preact](https://preactjs.com/) · TypeScript · [Vite](https://vite.dev/) · [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) · IndexedDB ([idb](https://github.com/jakearchibald/idb)) · [Tesseract.js](https://tesseract.projectnaptha.com/) · [@preact/signals](https://github.com/preactjs/signals)

### Belgeler

- [Mimari](docs/ARCHITECTURE.md): klasörler, veri akışı, faiz formülü, OCR hattı
- [Yol haritası](docs/ROADMAP.md)
- [Değişiklik günlüğü](CHANGELOG.md)
- [Gizlilik politikası](docs/PRIVACY.md)

## Uyarı

Faiz ve asgari ödeme hesapları, TCMB ve BDDK'nın yayımladığı kurallara dayanan **tahminlerdir**. Kesin tutar bankanın ekstresinde yazandır. Bu uygulama finansal danışmanlık sunmaz.

## Lisans

[MIT](LICENSE)
