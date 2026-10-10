---
version: 1
slug: "motion-system"
primary_target: "src/ui/nav.ts"
related_targets: ["src/ui/components/Sheet.tsx", "src/ui/components/TabBar.tsx", "src/ui/components/controls.tsx", "src/ui/tokens.css", "src/ui/base.css"]
---

# Hareket sistemi (app shell) brief

Mode: Operate. Kullanıcı isteği (2026-10-10): "sayfalar arası ve tıklamalarda yumuşak animasyonlar". Hareket burada geri bildirim, durum ve sürekliliğe hizmet eder; Özet'in tek yükleme anı (DESIGN.md Motion) odak an olarak kalır, yeni bir odak an eklenmez.

## Motion thesis

- **Focal moment:** değişmez — Özet'in yükleme anı (rakam yükselişi, spread/kart stagger, runway çizimi).
- **Continuity:** (1) sekme değişimi: içerik sekme sırasına göre yönlü kısa kayma + solma, tab bar sabit; aktif sekmenin vurgusu yeni sekmeye *akar* (shared element). (2) Alt pencere: aşağıdan tam kayarak gelir, kapanırken aşağı iner ve arka plan solar; artık anında kaybolmaz.
- **Feedback:** her dokunulabilir yüzey aynı basma dilini konuşur: kısa ölçek küçülmesi, bırakınca exponential dönüş. Toast girer ve çıkar.
- **Budget:** yalnızca transform/opacity; blur yok (sayfa geçişinde bulanıklık telefonda pahalı). View Transitions desteklenmiyorsa anında geçiş.

## Token'lar (tokens.css, :root)

| Token | Değer | Kullanım |
|---|---|---|
| `--dur-tap` | 120ms | basma geri bildirimi |
| `--dur-state` | 200ms | renk/durum değişimi |
| `--dur-page` | 300ms | sekme girişi (çıkış 130ms: `--dur-page-out`; giriş `--dur-page-gap` 50ms gecikmeli, iki sayfanın yazısı üst üste binmesin) |
| `--dur-sheet` | 380ms | pencere girişi |
| `--dur-sheet-out` | 220ms | pencere çıkışı (çıkış girişten hızlı) |
| `--press` | 0.97 | büyük yüzeyler için basma ölçeği (kart, satır: 0.985) |

Eğriler: giriş `--ease-out-expo`, çıkış `cubic-bezier(0.4, 0, 1, 1)` (`--ease-in`), küçük durumlar `--ease`. Bounce/elastic yok.

## Davranışlar

1. **Sekme geçişi** — `document.startViewTransition`. Yön: sekme sırası home(0) → expenses(1) → calendar(2) → settings(3); hedef > kaynak ise `forward`. Eski içerik 180ms'de 16px ters yöne kayarak solar, yeni içerik 300ms'de 24px'ten gelerek belirir. `.tabbar` kendi `view-transition-name`'ine sahip (animasyonsuz). Aktif sekme ikonu `view-transition-name: tab-active` taşır → vurgu sekmeler arasında kayar. Sayfa en üste kaydırma geçiş callback'i içinde olur.
2. **Alt pencere** — giriş: panel `translateY(100%)`→0 (`--dur-sheet`, expo), scrim 0→1 (240ms). Çıkış: `closeSheet()` önce `sheetClosing` durumuna geçer, panel aşağı iner ve scrim solar (`--dur-sheet-out`, `--ease-in`), sonra kaldırılır. Kapanırken yeni pencere açılırsa kapanış iptal. Odak, kapanış bitince opener'a döner.
3. **Basma** — `.btn`, liste satırları, kartlar, chip'ler, sekmeler: `:active` ölçeği, `transition: transform var(--dur-tap) var(--ease)`; bırakınca `--ease-out-expo` ile döner. `-webkit-tap-highlight-color: transparent`.
4. **Toast** — giriş: 12px aşağıdan + solma (240ms expo); çıkış: solma + 8px aşağı (160ms). Yeni toast eskisinin yerini çıkış beklemeden alır.

## Reduced motion

Uzamsal hareket yok; anlamlı durum değişimleri kalır: sekme geçişi 120ms çapraz solma, pencere scrim solması + panel anında konumda, basmada ölçek yok (renk değişimi kalır), toast yalnızca solma. `base.css`'teki genel `0.01ms` kuralı bu dosyadaki solmaları da sıfırlıyor; o kural yerine bileşen bazlı `prefers-reduced-motion` yolları kullanılır.

## Doğrulama

`npm run shots -- --motion` kareleri; reduced-motion açıkken geçişin çapraz solma olduğu; hızlı ardışık sekme dokunuşlarında takılma olmadığı (önceki geçiş `skipTransition()` ile atlanır); klavyeyle Escape ile pencere kapanışı ve odak dönüşü.
