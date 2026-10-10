---
version: 1
slug: "src-features-calendar-calendarpage-tsx"
primary_target: "src/features/calendar/CalendarPage.tsx"
related_targets: ["src/features/calendar/calendar-page.css", "src/features/calendar/calendarModel.ts"]
---

# Takvim surface brief

Scope: the Takvim tab. Mode: Operate. Inherits the Özet world (DESIGN.md); no new tokens. Lead decisions under owner delegation (2026-10-10).

Audience and job: the user looks ahead: which statement cuts, due dates and recurring payments land in the next 45 days, and handles recurring payments waiting to be recorded. Success: they see the next money-out at a glance, know which account each event belongs to, and add or skip a pending recurring payment in one tap.

## Direction contract

THESIS: The next 45 days as the wallet's agenda. Every event wears its account's owned colour exactly as Özet's payment rows do, so the user recognises the card before reading the text. Rejects the incumbent's box per event and its lime icons (DESIGN.md Lime Is Action Rule: lime never decorates).

OWN-WORLD: Özet's world unchanged. Account colour fills the event's date tile/medallion (Owned Colour Rule); category colour is not used here; lime only on the "Ekle" action; amber for due dates within 3 days (warn tokens), rose for overdue.

STORY: Pending recurring payments first (they need an action); then a one-line summary of the period; then the agenda by day; then the recurring list to manage.

FIRST VIEWPORT (360×780): title; pending recurring block (if any); summary figure; the first two agenda days.

FORM:
- **Pending recurring ("Bekleyen düzenli ödemeler"):** keep the amber-wash block; each item one row: name, "9 Eki · Bonus", amount; actions "Atla" (ghost) and "Ekle" (primary lime, compact 44 px). Several pending items stack inside one block with hairlines, not one block each.
- **Summary:** "Önümüzdeki 45 gün" as a title row with, on the right, the period's known money-out total ("~23.462 ₺ çıkacak", `~` when any minimum is estimated) computed by the model; under it a caption "N ödeme · M kesim".
- **Agenda:** per day a header row (day label left, e.g. "Bugün", "Yarın", "13 Eki, Salı"; the day's total right when it has amounts) and one slate container per day with hairline-separated rows. Row: a 36 px rounded-square medallion filled with the account's wallet colour (`data-slot` + `--c`/`--c-ink` as in Özet) carrying the event icon in wallet ink (card icon for kesim, alert for son ödeme, repeat for recurring); text "Bonus son ödeme" / "Maximum kesim" / "Spor salonu" with sub "Asgari 1.280 ₺" / "Maximum" ; amount right (figure-sm). Due-date rows within 3 days get the amber pill "3 gün kaldı" under the amount, overdue the rose pill. Kesim rows carry no amount. Rows that open something (recurring → recurring sheet; kesim/son ödeme → account detail) are buttons with `--press-row`; others are not interactive.
- **Recurring list ("Düzenli ödemeler"):** title row with "Aylık toplam 20.478 ₺" right; one slate container, hairline rows: account-colour 10 px dot (shape rule: small dot is allowed for accounts in lists? NO — dots are category shape) → use the same 36 px medallion with the repeat icon in the account colour; name, "Ayın 3. günü · Örnek Banka", amount. Footer row inside the container: "Düzenli ödeme ekle" with the drawn plus icon (no "+" glyph), lime text, ≥44 px.
- **Empty states:** no events → "Önümüzdeki 45 günde ödeme ya da kesim yok." caption in the agenda slot; no recurring → existing empty state with the add action.
- **Motion:** press language only.

## Logic

Add pure, tested helpers to `calendarModel.ts`: `periodSummary(days)` → `{ total: Kurus; estimated: boolean; payments: number; cuts: number }` and per-day totals. Existing `buildTimeline` / `groupByDay` stay the source.

FINISH: critique on captures, fix round, finish reviewer verdict, DESIGN.md Rollout status updated.

## As built (lead, 2026-10-10) — supersedes FORM where they differ

- Summary: the period total sits under the title at the hero figure size (`--text-hero`, same as Harcamalar's month total), caption "N ödeme · M kesim" plus "· asgari tutar tahmini" / "· N ödemenin tutarı girilmedi" when they apply.
- Agenda: one slate container with day divider rows (title-sm day label, day total only when the day has two or more amounts), matching Harcamalar's list.
- Pending recurring: primary action reads "Harcamaya ekle"; "Atla" is undoable from the toast; overdue items carry the rose "N gün geçti" pill.
- Rows that open a sheet end in a chevron; cut rows read "Ekstre kesimi".
- The 52 px payment date tile from Özet is not used here: the day divider already carries the date, so a tile would repeat it on every row; the 36 px account medallion keeps the Owned Colour Rule.
- Light-theme medallions get a 1 px inner hairline (yellow and green tiles vanish on white otherwise).
