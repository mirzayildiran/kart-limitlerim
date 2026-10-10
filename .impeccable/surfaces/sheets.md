---
version: 1
slug: "sheets"
primary_target: "src/ui/components/controls.tsx"
related_targets: ["src/ui/components/Sheet.tsx", "src/features/expenses/ExpenseSheet.tsx", "src/features/accounts/AccountDetailSheet.tsx", "src/features/accounts/AccountSheet.tsx", "src/features/statements/StatementSheet.tsx", "src/features/recurring/RecurringSheet.tsx", "src/features/categories/CategorySheet.tsx", "src/features/import/ImportSheet.tsx"]
---

# Alt pencereler (sheets) surface brief

Scope: every bottom sheet and the shared form controls they use. Mode: Operate. Inherits the Özet world (DESIGN.md) and the motion system (`.impeccable/surfaces/motion-system.md`). Lead decisions under owner delegation (2026-10-10).

Audience and job: enter or correct one thing fast — an expense, a statement, a recurring payment, an account, a category — and see what it does to the numbers before saving. Success: the primary field is obvious, choices show the same colours as the rest of the app, nothing wraps or clips at 360 px, and the effect of saving is previewed.

## Direction contract

THESIS: Forms that speak the wallet's language. Choosing an account means choosing a coloured card; the amount is the hero of the expense sheet; every sheet ends in one clear primary action. Rejects lime-filled account selection (DESIGN.md Owned Colour Rule: accounts are told by their wallet colour), text glyphs as icons ("+", "▶"), wrapped segment labels and duplicated figures.

OWN-WORLD: Özet's world unchanged. Lime = the primary action and "you are here" (selected category, focused field ring). Account colour fills account choices. Category colour only as a dot. Rose only for destructive actions and the interest figure. Amber for estimates needing attention.

STORY: open from a page action → the one field the sheet is for → the choices in the app's colours → the preview of what saving does → one primary action.

FIRST VIEWPORT (360×780): title (and subtitle when it names the account); the primary field; the first choice row.

FORM: inherits the Özet roll (seed 57a8a444, recorded in `.impeccable/surfaces/src-features-home-homepage-tsx.md`); the per-control and per-sheet rules below are the form.

## Shared controls (src/ui/components)

- **AccountPicker** (new, shared): horizontal snap-scrolling row of compact account chips (min 120×56, `--r-lg`): name (body-strong) + available/balance (caption, tabular). Unselected: slate `--surface-2`, 1px line, a 14×10 rounded-rect swatch in the account's wallet colour before the name (the tile shape in miniature; never a dot). Selected: filled with the wallet colour, wallet ink, `check` icon top-right, `aria-pressed`/radio semantics (`role="radiogroup"` + `role="radio"` + `aria-checked`). Used by ExpenseSheet, RecurringSheet, ImportSheet.
- **CategoryPicker** (new, shared): wrapping chips (≥44 px): category dot (`displayHue`) + name. Selected: `--accent-soft` wash, 1px `--accent` border, `check` icon; unselected slate. Last chip "Yeni" with the drawn `plus` icon (no "+" glyph). Used by ExpenseSheet, RecurringSheet.
- **Choice (segment look):** every option ≥44 px tall; labels never wrap (`white-space: nowrap`); when options cannot fit, the caller must shorten labels (see AccountSheet).
- **Disclosure** (new, shared): replaces `<details>` blocks that show a double marker; a button row with the label and a `chevron` icon rotating 90° (`--dur-state`), `aria-expanded`.
- **MoneyField `size="hero"`** variant: display face (`--font-display`), 2.5rem/800, tabular, ₺ via KL Lira; used as the first field of ExpenseSheet.
- **Plus icons:** every "+ …" text action becomes `Icon plus` + text.

## Per sheet

- **ExpenseSheet:** order: hero amount → AccountPicker ("Nereden ödedin?") → CategoryPicker → date with quick chips "Bugün" / "Dün" + the native date input → note → "Taksitli" Switch; when on, a chip row 2/3/6/9/12 appears (replaces the wrapping "Tek çekim" segment) → "Limitten / bakiyeden düş" Switch with its preview note → interest nudge (rose figure, ink text). "Ekran görüntüsünden ekle" stays at the top as a secondary button.
- **AccountDetailSheet:** header is a mini wallet card in the account's owned colour (name, available figure, track, meta like Özet) — the continuation of the card tapped on Özet; no separate summary box; stats row shows only what the card does not: "Limit" and "Kullanılan" (two tiles). Remove the empty gap. Interest panel: title + figure in rose, explanation and rows in `--ink`/`--muted` on `--crit-soft`; copy "Bu kartta toplam işleyen faiz" and the history line rewritten to read naturally (no "0 ekstre geçmişi"). Footer: primary "Bu karttan harcama ekle" (opens ExpenseSheet with `accountId`), secondary "Düzenle".
- **AccountSheet:** kind segment labels "Kart · KMH · Hesap · Nakit"; "Aynı limite bağlı kart ekle" with plus icon; "Faiz oranı" via Disclosure; delete stays a rose text ConfirmButton under the primary.
- **StatementSheet:** interest box: figure rose, breakdown ink; title names the scenario the figure assumes ("Ödemezsen…", "Kalanı ödemezsen…", "Yalnız asgariyi ödersen…"), late interest states its condition, and "Tamamını son ödemeye kadar ödersen faiz işlemez." closes it. The quick "Asgariyi ödedim" / "Tamamını ödedim" buttons were removed after the critique: the payment segment does the same in one tap and "Kaydet" is the single, validated commit path.
- **RecurringSheet:** AccountPicker + CategoryPicker; "Sonraki: …" note stays.
- **CategorySheet:** unchanged layout; field and switch spacing aligned with the others.
- **ImportSheet:** AccountPicker for "Hangi kart/hesap?"; rest unchanged in this pass.

## Verification

All sheets captured by `npm run shots` (sheet-*), 360/430 × dark/light, plus `-end` scrolls; no wrapped segment labels, no glyph icons, no lime-filled account choice; detector clean; keyboard: radiogroup arrows move selection in AccountPicker.

FINISH: critique on captures, fix round, finish reviewer verdict, DESIGN.md Components updated (AccountPicker, CategoryPicker, Disclosure, hero MoneyField).
