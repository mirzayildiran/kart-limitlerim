---
version: 1
slug: "src-features-expenses-expensespage-tsx"
primary_target: "src/features/expenses/ExpensesPage.tsx"
related_targets: ["src/features/expenses/expenses-page.css", "src/features/expenses/expenseModel.ts"]
---

# Harcamalar surface brief

Scope: the Harcamalar tab. Mode: Operate. Second surface of the redesign; inherits the Özet world (DESIGN.md) without new tokens. Decisions by the lead under owner delegation (2026-10-10).

Audience and job: the user checks where this month's money went and finds one expense to fix or delete. Success: they see the month total, which categories and which accounts it came from, and reach any expense in two taps; tapping a category or an account narrows the list to it.

## Direction contract

THESIS: The month as a ledger lit by the wallet. Accounts appear as small filled tiles in their owned colour (the wallet, miniaturised); categories stay dots and thin bars; the list is one quiet slate surface per day, not a card per expense. Rejects the incumbent's box-per-row list (DESIGN.md Don't: grey list of rows) and the duplicate "Harcama ekle" button.

OWN-WORLD: Özet's world unchanged: night ground, slate surfaces, neon lime only for action and the active filter, wallet seven by creation order (Owned Colour Rule: account colour fills tiles; category colour only dot and bar). Light theme from the same tokens.

STORY: Pick the month; read the total; see categories as bars and accounts as coloured tiles; tap one to filter; scan the day groups with a day total; tap a row to edit.

FIRST VIEWPORT (360×780): title and month switcher; month total in the display figure size (`--text-hero`) with "N harcama"; category bars (top 6, then "Tümünü göster" when more); the start of the account tiles.

FORM:
- **Month switcher:** a single pill: chevron, month label, chevron; the next chevron is disabled (not hidden) in the current month. Swipe is not added.
- **Summary:** figure + count; when a filter is active the figure and count describe the filtered set and a lime filter chip ("Eğlence ✕" with a drawn close icon, not a glyph) sits under the figure; tapping it clears.
- **Categories:** one slate container; each row is a button (≥44 px): dot, name, amount, thin bar (category hue). Tapping filters by that category (toggle); the active row gets the lime soft wash; others dim to 0.55 opacity. Top 6 by amount; the rest behind "Tümünü göster".
- **Accounts ("Kaynağa göre"):** a 2-column grid of small filled tiles, each in its owned wallet colour with wallet ink: name (ellipsis) top, amount bottom (figure, tabular). Tile radius `--r-lg`, min height 64 px, press scale `--press`. Tapping filters by account (toggle; same active/dim rules; the active tile gets a 2px ink ring inset). Category and account filters combine (AND).
- **List:** per day a header row (day label left, day total right, both caption/label sizes, muted) and one slate container with hairline-separated rows. Row: category dot, label (body-strong), sub ("Kategori · Hesap", plus "· N taksit" when instalments), amount right (figure-sm, tabular). Row press `--press-row`. No per-row card, no left stripe.
- **Empty states:** no expenses in month → existing EmptyState with "Harcama ekle" CTA stays; filter with no results → one line "Bu filtrede harcama yok" + "Filtreyi kaldır" ghost button.
- **Removed:** the bottom "Harcama ekle" button when the list is non-empty (the + in the tab bar is the add action).
- **Motion:** the motion system's press language only; filter change cross-fades the list (opacity 0.6→1, `--dur-state`); no load choreography on this tab (Özet keeps the one authored moment).

## Logic

Filtering is pure and tested: `filterExpenses(expenses, { categoryId?, accountId? })` and `dayTotals` in `expenseModel.ts`; filter state is page-local signals reset when the month changes.

FINISH: dual-agent critique on captures, fix round, finish reviewer verdict, DESIGN.md Rollout status updated.

## As built (lead, 2026-10-10) — supersedes FORM where they differ

- Category preview is 4, not 6: the FIRST VIEWPORT promises the start of the account tiles, and six category rows push them below 780 px.
- One list container for the month with day divider rows on a toned band (`--surface-2`), not one container per day: with sparse days a per-day container reads as a box per expense, and the band keeps the light theme from reading as a stack of white rows.
- Unselected filter items are not dimmed (dimming broke text contrast on the wallet fills); selection is a ring plus a check icon, and the chosen account tile glows in its own colour (Self-Lit). The ring sits outside the fill (`outline-offset: 2px`): an inset ring vanished on the yellow and orange slots.
- Filters are faceted: tiles and rows narrow to the other filter, and options whose intersection is empty are disabled (`aria-disabled`, 0.4 opacity, exempt as inactive controls); the empty-filter text names the filters ("Eğlence ve Axess için harcama yok").
- The status line reads "Ekim toplamı · N harcama" or the filter names; a filter tap gives an 8 ms haptic tick where supported.
- Section titles "Hesaba göre" (the product's word is hesap) and "Tüm harcamalar"; "Dokunarak süz" caption beside "Kategoriler".

## Finish record (2026-10-10)

Dual-agent critique 24/40 (A) + clean measurement (B: contrast 111/111, no target under 44 px) → fix round → finish reviewer `fix` → second round (ring documented, self-lit glow, figure face, toned day bands, haptic) → `disposition: ship` (covers the scored fixes).
