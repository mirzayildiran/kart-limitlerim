# İlerleme günlüğü

Tasarım çalışmasının (Impeccable) ve bütçe asistanının durumu. En yeni kayıt en üstte. Çalışma dalı: `claude/epic-thompson-phlm18`; asistan dalı: `claude/budget-assistant` (ayrı Opus oturumu).

Yöntem: Opus yönetir (brief, karar, inceleme, commit); uygulama, ekran görüntüsü ve ölçüm işlerini Haiku alt ajanları yapar. Her ekran için: `shape` brief'i → Haiku uygulaması → çift ajanlı `critique` (tasarım incelemesi + detector/erişilebilirlik ölçümü) → düzeltme turları → `impeccable-finish-reviewer` kararı (ship / fix / rebuild).

## Durum tablosu

| Yüzey | Brief | Uygulama | İnceleme | Karar |
|---|---|---|---|---|
| Özet | ✅ | ✅ | ✅ 3 tur | **ship** |
| Hareket sistemi (sayfa geçişleri, pencereler, basma, toast) | ✅ | ✅ | ✅ kare kontrolü | uygulandı |
| Harcamalar | ✅ | ✅ düzeltme turu sürüyor | ⏳ | ⏳ |
| Takvim | ✅ | ⏳ | ⏳ | ⏳ |
| Ayarlar | ✅ | ⏳ | ⏳ | ⏳ |
| Alt pencereler (7 adet) | ⏳ | ⏳ | ⏳ | ⏳ |
| Bütün uygulama: harden, onboard, adapt, audit, polish | ⏳ | ⏳ | ⏳ | ⏳ |
| Bütçe asistanı (ayrı oturum) | yol haritasında | ayrı Opus oturumu | ⏳ | ⏳ |

## Kayıtlar

### 2026-10-10
- Impeccable projeye kuruldu (`.claude/skills/impeccable`, ajanlar, detector hook'u). impeccable.style ağda engelli olduğu için GitHub'dan kuruldu.
- `npm run shots`: uydurma demo verisiyle 360/430 px, koyu/açık tema ekran görüntüleri (`.impeccable/review/shots/`, git'e girmez).
- Özet bitiş incelemesi: 22/36 → 3 düzeltme turu → ship. Kapananlar: nakit notu kesilmesi, 360 px kart sıkışması, kesim hapında tarih, açık tema kontrastı (Ödendi 4.56:1), dokunma hedefleri, kart üstü etiket (kicker), mor kategori tonları (`displayHue`), bölünen tarihler, kart kompozisyonu (çip adın altında), DESIGN.md renk kuralları.
- Hareket sistemi: View Transitions ile yönlü sekme geçişi, aktif sekme vurgusunun akması, alt pencerelerin animasyonlu kapanması, ortak basma dili, toast giriş/çıkışı, bileşen bazlı reduced-motion yolları. Geçiş ortasında iki sayfanın yazısı üst üste binmesin diye çıkış kısaltıldı, giriş 50 ms geciktirildi.
- Harcamalar yeniden tasarlandı: hesap karoları cüzdan renklerinde, kategori/hesap süzgeci, tek liste kabı, gün toplamları, tekrar eden "Harcama ekle" düğmesi kaldırıldı.
- Takvim ve Ayarlar brief'leri yazıldı, paralel Haiku ajanlarına verildi.
- Bütçe asistanı için ayrı Opus oturumu açıldı (karar: ücretsiz bulut API'leri; anahtar yöntemi o oturumda sana soruluyor).
