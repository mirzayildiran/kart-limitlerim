---
version: 1
slug: "src-features-settings-settingspage-tsx"
primary_target: "src/features/settings/SettingsPage.tsx"
related_targets: ["src/features/settings/settings-page.css", "src/features/settings/InstallGuide.tsx", "src/features/settings/install-guide.css", "src/features/settings/settingsModel.ts"]
---

# Ayarlar surface brief

Scope: the Ayarlar tab. Mode: Operate. Inherits the Özet world (DESIGN.md); no new tokens. Lead decisions under owner delegation (2026-10-10).

Audience and job: occasional visits to change the theme, manage categories, back up or restore, read how interest is estimated, or wipe data. Success: every setting is found in one scroll, the privacy promise is unmistakable, and nothing destructive happens by accident.

## Direction contract

THESIS: A calm settings page that still belongs to the wallet world: slate groups on the night ground, sentence-case section titles that stand on their own, the privacy promise stated as the page's quiet anchor. Rejects the incumbent's small muted labels floating above each group (they read as kickers), the always-on install guide at the top, and the dense rate paragraph.

OWN-WORLD: Özet's world unchanged. Lime only for actions ("Kategori ekle", primary buttons; the segmented control's selected option sits on slate per DESIGN.md Choice); rose only for the destructive action; category colour as dots.

STORY: Görünüm → Kategoriler → Yedek → Faiz nasıl tahmin ediliyor → Gizlilik → Uygulama gibi kullan (only when not installed) → Tehlikeli bölge → version line.

FIRST VIEWPORT (360×780): title; Görünüm; Kategoriler starting.

FORM:
- **Section titles:** `title-sm` (18px/700, ink colour) as real `h2` headings with 24 px above and 8 px below; delete the small muted labels.
- **Görünüm:** the existing three-way segmented control, inside its group with its own label text "Tema".
- **Kategoriler:** one container, hairline rows (dot, name, chevron, ≥48 px), footer row "Kategori ekle" with the drawn plus icon in lime. Archived categories (if the model exposes them) under a collapsed "Arşivdekiler (N)" row.
- **Yedek:** the privacy sentence on top, then two secondary buttons side by side at ≥400 px, stacked below; after a successful download show the last backup date as caption if the page already knows it (do not add storage).
- **Faiz nasıl tahmin ediliyor:** a definition list: each rate row has the label left and the figures right, tabular ("30.000 ₺ altı" … "%3,25 · gecikme %3,55"); KKDF/BSMV and minimum-payment rule as their own rows; sources as caption lines at the bottom; closing caption "Bankan daha düşük oran uyguluyorsa kart ayarlarından kendi oranını girebilirsin." Use the existing `settingsModel` line builders, restructured into label/value pairs (pure, tested).
- **Gizlilik:** a slate group with a drawn lock/shield icon (use an existing Icon name; if none fits, no icon) and the two sentences; no new claims.
- **Uygulama gibi kullan (InstallGuide):** moved near the bottom and rendered only when `matchMedia('(display-mode: standalone)')` is false and `navigator.standalone` is not true; steps keep their numbers (the sequence carries meaning); the Android menu glyph "⋮" is replaced by the words "menü (üç nokta)".
- **Tehlikeli bölge:** keep ConfirmButton; rose text button inside a group with one caption line saying it cannot be undone.
- **Version line:** caption, centred, "Kart Limitlerim · sürüm X" reading the version from `package.json` via Vite define if already available; otherwise keep the existing source.
- **Motion:** press language only.

FINISH: critique on captures, fix round, finish reviewer verdict, DESIGN.md Rollout status updated.

## Adaptations recorded after build (lead, 2026-10-10)

- Backup buttons stay stacked at every width: at 430 px side by side, "Yedekten geri yükle" wrapped to two lines (measured in the 430 capture); stacking keeps both labels on one line and the restore action no wider than the download.
- Rate values break into two lines ("akdi %3,25" / "gecikme %3,55"): at 360 px the single-line form squeezed the label column to about 100 px and wrapped the labels to three lines.
- The restore confirmation is part of the backup group, separated by a hairline, not a nested box (craft floor: nested cards).
- STORY gains "Bütçe asistanı" between "Faiz nasıl tahmin ediliyor" and "Gizlilik" (merged from the assistant branch; product decision recorded in PRODUCT.md, 2026-10-10): one group with a sentence and a secondary "Asistanı aç" button. The header caption drops "sunucu yok" because the optional chat sends a summary through the project's proxy; the Gizlilik group states that exception in full.
- The restore error sits in the backup group under a hairline like the confirmation, not as a nested box; "Vazgeç" is a slate secondary button (lime marks forward action only).
