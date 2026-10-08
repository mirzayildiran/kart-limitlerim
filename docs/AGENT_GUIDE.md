# Geliştirici rehberi (agent'lar için de geçerli)

Bu proje bir lider (planlama, inceleme, birleştirme) ve görev bazlı geliştiricilerle ilerler. Her görev hangi dosyaların sana ait olduğunu söyler; **yalnızca o dosyalara yaz**.

## Mimari

```
src/
  domain/     Saf iş mantığı. UI ve tarayıcı API'si yok. Her dosyanın *.test.ts'i var.
  data/       IndexedDB (db.ts), yedek (backup.ts), uygulama durumu ve eylemler (store.ts)
  ui/         Tasarım sistemi: tokens.css, base.css, components/, nav.ts
  features/   Ekranlar ve pencereler: home/, accounts/, expenses/, statements/, calendar/, recurring/, settings/
```

- **Durum:** `src/data/store.ts` sinyalleri okunur (`accounts.value`, `cards.value`, `power.value`…). Veri yalnızca store'daki eylemlerle değişir (`saveAccount`, `saveExpense`, `createCategory`…). Bileşen IndexedDB'ye doğrudan dokunmaz.
- **Gezinme:** `src/ui/nav.ts`. Sayfalar `go('expenses')`, düzenleyiciler `openSheet({ type: 'expense' })`. Aynı anda tek pencere açık olur.
- **Para:** Her tutar tam sayı **kuruş**. Ekrana `formatTL` / `formatTLExact`, girişten `parseTL` ile (`src/domain/money.ts`). Asla `toFixed` ya da elle biçim yok.
- **Tarih:** Yerel takvim günü. `src/domain/dates.ts` yardımcılarını kullan. `today.value` sinyali gün değişince yenilenir.

## Arayüz kuralları

- Önce mobil: 360–430 px genişlik hedef, en az 16 px kenar boşluğu, yatay kaydırma yok.
- Renkler yalnızca `tokens.css` değişkenlerinden. Ham hex yazma. Açık ve koyu temada okunur olmalı.
- Hazır bileşenleri kullan: `Sheet`, `Button`, `MoneyField`, `TextField`, `Switch`, `Choice`, `Pill`, `ConfirmButton`, `EmptyState`, `Icon`, `toast()`.
- Dokunma hedefi en az 44 px. Her kontrolün görünür bir etiketi ya da `aria-label`'ı olsun.
- Sayılar `class="num"` (tabular). Tutarlar Schibsted Grotesk (`--font-display`), metin Onest.
- Her bileşenin CSS'i kendi dosyasında (`Foo.tsx` + `foo.css`), sınıf adları bileşene önekli (`.limit-strip-…`). Global seçici yazma.
- Metinler Türkçe, sade ve eylemi söyleyen dilde: "Kaydet", "Harcama eklendi". Hata mesajı ne olduğunu ve ne yapılacağını söyler.
- `alert()`, `confirm()`, `prompt()` yok. Silme gibi geri dönüşsüz işlemler `ConfirmButton` ile.

## Kalite kapısı

Görevi bitirmeden önce hepsi temiz geçmeli:

```bash
npx tsc -b
npm test
npm run build
```

- Kullanılmayan değişken veya import bırakma (TypeScript hata verir).
- `@ts-ignore`, `any`, `eslint-disable` kullanma.
- Testlerde yalnızca uydurma veri kullan; gerçek kişi bakiyesi yok.
- Git komutu çalıştırma; commit'i lider yapar.
