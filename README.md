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
| 🚧 | Kartlar, KMH, nakit ve hesaplar; kullanılabilir limite göre sıralı |
| 🚧 | Kesim ve son ödeme takvimi, asgari ödeme takibi |
| 🚧 | Harcamalar ve kendi oluşturduğun kategoriler |
| 🚧 | Düzenli ödemeler ve taksitler |
| ⏳ | Kesim sonrası faiz tahmini |
| ⏳ | Ekran görüntüsünden harcama aktarma (cihaz üzerinde OCR) |
| ⏳ | App Store ve Google Play sürümleri |

Ayrıntılı plan için [yol haritasına](docs/ROADMAP.md) bak.

## Gizlilik

- Bütün veriler **yalnızca senin cihazında** (IndexedDB) saklanır. Hesap, sunucu ya da takip kodu yok.
- Banka şifresi veya kart numarası **hiçbir zaman istenmez**.
- Ekran görüntüleri cihazda okunur ve okunduktan sonra saklanmaz.

## Geliştirme

Gereksinim: Node.js 22+

```bash
npm install
npm run dev        # geliştirme sunucusu
npm test           # birim testleri (Vitest)
npm run build      # üretim derlemesi (dist/)
```

`main` dalına yapılan her gönderim testlerden geçtikten sonra GitHub Pages'e otomatik yayınlanır.

### Teknoloji

[Preact](https://preactjs.com/) · TypeScript · [Vite](https://vite.dev/) · [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) · IndexedDB ([idb](https://github.com/jakearchibald/idb)) · [Tesseract.js](https://tesseract.projectnaptha.com/) (planlanan)

## Uyarı

Faiz ve asgari ödeme hesapları, TCMB ve BDDK'nın yayımladığı kurallara dayanan **tahminlerdir**. Kesin tutar bankanın ekstresinde yazandır. Bu uygulama finansal danışmanlık sunmaz.

## Lisans

[MIT](LICENSE)
