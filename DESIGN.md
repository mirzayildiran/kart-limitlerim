---
name: Kart Limitlerim
description: A colourful, alive wallet on a night ground; one spending figure you can act on, split into the colours of the cards it comes from.
colors:
  lime-action: "#c6ff2e"
  lime-action-bright: "#d8ff6b"
  lime-soft: "#1e2a08"
  lime-tint: "#2d400d"
  light-lime-action: "#3f7a00"
  light-lime-soft: "#e9f6d4"
  runway-cyan: "#2ef2ff"
  runway-magenta: "#ff4fd8"
  wallet-orange: "#ff6a1a"
  wallet-electric-blue: "#2557f0"
  wallet-magenta: "#e52fd8"
  wallet-green: "#14d98a"
  wallet-hot-pink: "#ff2e6e"
  wallet-yellow: "#ffe14d"
  wallet-cyan: "#00cfff"
  wallet-ink: "#ffffff"
  wallet-dark-ink: "#0a0a11"
  night-ground: "#0a0a11"
  slate-surface: "#14141e"
  slate-surface-2: "#1a1a26"
  slate-surface-3: "#242433"
  night-line: "#232333"
  night-line-strong: "#353549"
  moon-ink: "#f5f5fa"
  mist-muted: "#a3a3b9"
  dusk-faint: "#6d6d84"
  kmh-lilac: "#b48bff"
  ok-neon: "#19e68c"
  warn-amber: "#ffc24d"
  warn-amber-soft: "#2e2309"
  warn-bar: "#ffb020"
  crit-neon: "#ff5c7a"
  crit-soft: "#36101c"
  light-ground: "#f5f5f8"
  light-surface: "#ffffff"
  light-surface-2: "#f8f8fb"
  light-surface-3: "#ebebf1"
  light-line: "#e3e3ea"
  light-ink: "#12121a"
  light-muted: "#5f5f72"
  light-ok: "#0f8a5f"
  light-warn: "#9a5a0c"
  light-crit: "#b3372a"
typography:
  display:
    fontFamily: "Schibsted Grotesk Variable, Onest Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(3.25rem, 17vw, 4.75rem)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Schibsted Grotesk Variable, Onest Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Schibsted Grotesk Variable, Onest Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  title-sm:
    fontFamily: "Schibsted Grotesk Variable, Onest Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  figure:
    fontFamily: "Schibsted Grotesk Variable, Onest Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "tnum"
  body:
    fontFamily: "Onest Variable, Onest, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.45
  body-strong:
    fontFamily: "Onest Variable, Onest, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.3
  label:
    fontFamily: "Onest Variable, Onest, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.35
  caption:
    fontFamily: "Onest Variable, Onest, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.35
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  card: "20px"
  xl: "22px"
  2xl: "28px"
  pill: "999px"
spacing:
  s-1: "4px"
  s-2: "8px"
  s-3: "12px"
  s-4: "16px"
  s-5: "20px"
  s-6: "24px"
  s-8: "32px"
  gutter: "16px"
components:
  button-primary:
    backgroundColor: "{colors.lime-action}"
    textColor: "{colors.wallet-dark-ink}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "52px"
  button-secondary:
    backgroundColor: "{colors.slate-surface-2}"
    textColor: "{colors.moon-ink}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "44px"
  button-ghost:
    textColor: "{colors.lime-action}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.md}"
    padding: "0 8px"
    height: "44px"
  input:
    backgroundColor: "{colors.slate-surface-2}"
    textColor: "{colors.moon-ink}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "48px"
  chip:
    backgroundColor: "{colors.slate-surface-2}"
    textColor: "{colors.mist-muted}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "38px"
  chip-selected:
    backgroundColor: "{colors.lime-action}"
    textColor: "{colors.wallet-dark-ink}"
    rounded: "{rounded.pill}"
  pill-warn:
    backgroundColor: "{colors.warn-amber-soft}"
    textColor: "{colors.warn-amber}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  pill-crit:
    backgroundColor: "{colors.crit-soft}"
    textColor: "{colors.crit-neon}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  wallet-card:
    backgroundColor: "{colors.wallet-orange}"
    textColor: "{colors.wallet-ink}"
    rounded: "{rounded.card}"
    padding: "18px 20px"
    width: "min(80%, 340px)"
  wallet-card-bright:
    backgroundColor: "{colors.wallet-green}"
    textColor: "{colors.wallet-dark-ink}"
    rounded: "{rounded.card}"
    padding: "18px 20px"
  runway-panel:
    backgroundColor: "{colors.slate-surface}"
    textColor: "{colors.moon-ink}"
    rounded: "{rounded.2xl}"
    padding: "20px 20px 16px"
  list-card:
    backgroundColor: "{colors.slate-surface}"
    textColor: "{colors.moon-ink}"
    rounded: "{rounded.lg}"
    padding: "16px"
  status-note-warn:
    backgroundColor: "{colors.warn-amber-soft}"
    textColor: "{colors.moon-ink}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
  status-note-crit:
    backgroundColor: "{colors.crit-soft}"
    textColor: "{colors.moon-ink}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
  fab:
    backgroundColor: "{colors.lime-action}"
    textColor: "{colors.wallet-dark-ink}"
    rounded: "{rounded.pill}"
    size: "56px"
  tab-bar:
    backgroundColor: "{colors.slate-surface}"
    textColor: "{colors.mist-muted}"
    height: "64px"
  tab-item-active:
    textColor: "{colors.lime-action}"
---

# Design System: Kart Limitlerim

## Overview

**Creative North Star: "Canlı Gece"** (Lively Night)

The app is a night ground lit by the user's own cards. Near-black space and quiet slate surfaces hold everything still, so that colour arrives only where it means something: each account is a vivid card in a colour it owns, the spending figure above is split into those same colours, a cyan line falls across a slate panel toward the statement date, and one neon lime marks every action. The mood is bright and tactile rather than sober: things glow a little in their own colour, shrink slightly under a finger, and settle in with a single exponential load moment. It should feel professional and pleasing on first open and clearly unlike a bank app or a grey ledger of white rows.

Density is mobile-first and generous: one column, at most 560px wide, 24px between blocks, money set large in a tight grotesk while all reading text sits in a softer humanist sans. Dark is the default theme; light remains available in Settings with the same wallet colours on a white ground. Copy is Turkish, sentence case throughout.

The user has explicitly rejected, across this redesign: grey stone ground with an evergreen accent, a warm peach ground, and violet panels or accents; and, as a durable brand commitment, any themed costume world (road signs, boarding passes, transit boards, calendars, banknotes). Treat those as closed doors.

Rollout status: the world is built on the Özet tab (`src/features/home/`) and its shared components (Amount, LimitStrip, controls, Sheet, TabBar). Harcamalar, Takvim, Ayarlar and the sheets have not been migrated; they inherit the tokens only and are the rollout target for this document, not evidence of it.

**Key Characteristics:**
- Near-black ground, slate surfaces, colour reserved for meaning.
- Seven neon wallet colours, each owned by one account and repeated wherever that account appears.
- Neon lime is the single action colour.
- Cyan line and magenta selected day are the runway panel's own pair; the wallet's cyan and magenta slots are account colours, never runway markers.
- Money in Schibsted Grotesk; words in Onest; the ₺ sign always drawn by Onest.
- Pressable surfaces shrink on press; cards glow in their own colour.
- One load moment with exponential ease-out, off under reduced motion.

## Colors

A night palette: neutral near-black and slate carry the structure, and saturated neon arrives in three disciplined families (action lime, runway pair, wallet seven).

### Primary
- **Neon Lime** (lime-action): the action colour. The raised + button, the active tab, primary buttons, focus rings, switches when on, selected chips, the caret, and the free-limit fill in limit strips. Text on it is always near-black (wallet-dark-ink).
- **Bright Lime** (lime-action-bright): the pressed/strong variant, used for the + button's focus ring.
- **Lime Moss** (lime-soft) and **Lime Shade** (lime-tint): dark lime washes. Moss backs the cash-after-payments note and input focus halos; Shade is the text-selection colour.

### Secondary
- **Runway Cyan** (runway-cyan): the spending-power line in the runway plot, recurring-payment markers, and the dot on ordinary runway events.
- **Runway Magenta** (runway-magenta): the scrubbed (selected) day dot and the kesim (statement cut) marker; also the runway plot's focus outline.

### Tertiary: the wallet seven
Assigned in this order, slot 1 to 7, by account creation order, wrapping after seven:
- **Electric Blue** (wallet-electric-blue) carries white ink (wallet-ink); **Ember Orange** (wallet-orange) and **Neon Magenta** (wallet-magenta) carry dark ink.
- **Signal Green** (wallet-green) carries near-black ink.
- **Hot Pink** (wallet-hot-pink) carries dark ink.
- **Sodium Yellow** (wallet-yellow) and **Pool Cyan** (wallet-cyan) carry near-black ink.

Category colours are derived from each category's stored hue at neon saturation: `hsl(hue 95% 62%)` in dark, `hsl(hue 68% 50%)` in light. They appear only as the category swatch and bar fill.

### Neutral
- **Night Ground** (night-ground): the page background and the ring that cuts the + button out of the tab bar.
- **Slate Surface** (slate-surface): cards, list containers, the runway panel, the tab bar, sheets.
- **Raised Slate** (slate-surface-2): secondary buttons, inputs, chips, row hover/press.
- **Deep Slate** (slate-surface-3): empty tracks of bars.
- **Night Line** (night-line) and **Strong Line** (night-line-strong): hairline borders and dividers; strong line for inactive dots, switch-off, the dashed add-card outline.
- **Moon Ink** (moon-ink): primary text and figures.
- **Mist** (mist-muted): secondary text, the ₺ sign, captions, inactive tab labels.
- **Dusk** (dusk-faint): hints and input suffixes only.

### Semantic
- **Neon Green** (ok-neon), **Amber** (warn-amber, with warn-amber-soft wash and warn-bar for low-limit fills), **Neon Rose** (crit-neon, with crit-soft wash). Status notes use the soft wash as background with ink text; only the figure or pill text takes the strong semantic colour.
- **KMH Lilac** (kmh-lilac): the fill of KMH (overdraft) limit strips, distinguishing them from card limits.

### Light theme
Light swaps the neutrals and semantics (light-ground, light-surface, light-surface-2, light-surface-3, light-line, light-ink, light-muted, light-ok, light-warn, light-crit) and keeps the wallet seven and runway pair unchanged. The runway panel stays a near-black slate in light (#14141f) so the neon line still glows. The light action colour is deep lime (#3f7a00, soft #e9f6d4), the readable-on-white sibling of the dark theme's neon lime.

### Named Rules
**The Owned Colour Rule.** Every account owns one wallet colour by creation order, and that colour follows it everywhere: its card, its spread segment, its payment date tile, the tint of its payment row. Never assign colour by balance, rank or bank brand; a colour must never jump when numbers change. Shape tells account colour from category colour: account colour fills cards, spread segments and date tiles; category colour (its hue at neon saturation, violet band shifted out by `displayHue`) appears only as a dot or a thin bar, never as a filled card or tile. A category may share a hue with a wallet slot; it may never share its shape.

**The Dark Ink Rule.** Every wallet colour carries near-black ink and a dark translucent veil, except Electric Blue (slot 2), which carries white ink and a white veil. This keeps small card text at 4.5:1 or better on every neon.

**The Lime Is Action Rule.** Neon lime means "you can act here", "you are here", or, in a limit strip, "this much is still yours to spend". It never decorates, and never charts anything other than free limit.

**The Runway Pair Rule.** Inside the runway panel, cyan is the line and recurring events and magenta is the selected day and the kesim (user-pinned, 2026-10-10). Outside the panel neither runway token appears. The wallet seven include a cyan and a magenta slot; those are account colours and are told apart by shape (filled card versus line and dot), the same way the Owned Colour Rule separates categories.

## Typography

**Display Font:** Schibsted Grotesk Variable (with Onest Variable, system sans)
**Body Font:** Onest Variable (with Onest, system sans)
**Lira glyph:** a `KL Lira` face, restricted to U+20BA, pulls the ₺ from Onest and sits first in the display stack.

**Character:** A tight, confident grotesk for every figure and heading against a friendly humanist sans for everything you read. The pairing keeps numbers crisp and assertive while sentences stay warm.

### Hierarchy
- **Display** (800, clamp(3.25rem, 17vw, 4.75rem), line-height 1, -0.04em): the spending-power figure on Özet only, with proportional numerals. The shared hero size elsewhere is the smaller `--text-hero` (clamp(3rem, 15vw, 4.25rem)).
- **Headline** (700, 28px, 1.15, -0.025em): the greeting at the top of Özet.
- **Title** (700, 22px, -0.02em): section headings ("Ödemeler", "Harcamalar").
- **Title small** (700, 18px, -0.015em): panel headings ("Kesime kadar") and the account name on a wallet card.
- **Figure** (700, 28px, tabular): large amounts; wallet cards set theirs at 30px (-0.02em). Medium and row amounts step down to 22px, 18px and 15px, always in the display face.
- **Body** (400, 15px, 1.45): running text; body-strong (600) for row names and note titles.
- **Label** (500 to 600, 13px): the hero label, sublines, dates, field labels, section meta, in Mist.
- **Caption** (500 to 600, 12px): card meta, axis labels, runway event chips, tab labels (11px), pills (11.5px).

### Named Rules
**The Figure Face Rule.** Every money figure is set in the display face; the ₺ sign is set in Onest at 0.62em, weight 600, in Mist (or the figure's semantic colour). The display face's own ₺ reads as £ and must never show.

**The Sentence Case Rule.** All labels and headings are Turkish sentence case. No uppercase labels, no tracked-out small caps.

**The Tabular Money Rule.** Amounts in lists and rows use tabular numerals (`.num`); only the hero figure and thousands separators switch to proportional spacing for optical tightness.

## Layout

A single centred column, max 560px, with a 16px gutter; the tab bar is fixed at 64px plus the safe area. Spacing sits on a 4px grid (4, 8, 12, 16, 20, 24, 32). Özet stacks blocks 24px apart; inside a section, headers sit 12px above content and stacked rows 8px apart. Headings and labels are inset 4px from the card edges so text aligns with card content rather than card borders.

The wallet breaks the gutter: its rail runs edge to edge, cards at min(80%, 340px) with 12px between them, scroll-snapping to the start so the next card peeks. Status notes that relate to the block above (cash note, recurring banner) pull up by 12px to read as its footnote.

Every tappable row is at least 44px tall; primary buttons are 52px; inputs 48px with 16px text so iOS never zooms.

## Elevation & Depth

Dark is flat by tone, not by shadow: neutral surfaces carry no shadow at all (`--shadow-1` and `--shadow-hero` resolve to none in dark), and depth comes from the step between Night Ground and the slate surfaces plus hairline Night Line borders. Light comes from colour itself: wallet cards cast a soft glow in their own hue. Shadows exist only for things that genuinely float.

### Shadow Vocabulary
- **Self-lit card glow** (`0 14px 30px -14px <card colour>, 0 2px 6px rgb(0 0 0 / 0.08)`): wallet cards only, coloured by the card's own wallet colour.
- **Float** (`0 10px 30px rgb(0 0 0 / 0.5)` in dark): sheets, the + button, toasts.
- **Cut-out ring** (`0 0 0 5px <ground>`): the + button, making it look punched out of the tab bar.
- **Selected-day halo** (`0 0 0 4px <panel>, 0 0 0 5px rgb(255 79 216 / 0.5)`): the runway's scrubbed day.
- **Light-theme lift** (`0 1px 2px rgb(18 18 26 / 0.05), 0 8px 20px -8px rgb(18 18 26 / 0.1)`): resting surfaces in light theme only.

### Named Rules
**The Self-Lit Rule.** In dark, only colour glows. A neutral surface never gets a shadow; a wallet-coloured object may glow in its own colour, never in another.

## Shapes

Soft, friendly rounding that scales with the object: 8px for focus rings and small controls, 12px for buttons and inputs, 16px for list cards, rows and notes, 20px for wallet cards (real card proportions, aspect ratio 1.586), 22px for the top of sheets, 28px for the runway panel, full pills for chips, pills, tracks, bars, dots and the + button. Payment date tiles are 52px squares at 14px radius. Borders are 1px hairlines; the only dashed strokes are the add-card outline (2px), the runway baseline and the scrub cursor.

## Components

### Buttons
Bright and tactile: they answer the finger.
- **Shape:** gently rounded (12px).
- **Primary:** neon lime with near-black text, 52px tall, 16px text, weight 600.
- **Secondary:** raised slate with a hairline border, 44px tall.
- **Ghost:** lime text, no fill.
- **Danger:** neon rose text; when armed, a rose wash.
- **Press:** scale to 0.98 over 0.1s. Disabled at 45% opacity.
- **Focus:** 2px lime outline at 2px offset.

### Chips and Pills
- **Choice chips:** 38px pills on raised slate with hairline border and Mist text; selected fills neon lime with near-black text. Segmented choice sits in a raised-slate track, the selected segment on Slate Surface.
- **Status pills:** 11.5px, weight 600, on the semantic wash (amber for days left, rose for overdue).

### Cards / Containers
- **Corner Style:** 16px.
- **Background:** Slate Surface with a Night Line hairline; no shadow in dark.
- **Internal Padding:** 16px; list rows 12px by 16px, divided by hairlines; row press tints to Raised Slate.
- **Limit strip:** name and subline left, figure right, a 6px track below filling in lime (lilac for KMH, amber when low). Shrinks to 0.985 on press.

### Inputs / Fields
- **Style:** raised slate, hairline border, 12px radius, 48px tall, 16px text. Money inputs set the value in the display face at 22px with a faint ₺ suffix.
- **Focus:** border turns lime with a 3px Lime Moss halo.
- **Error:** border in neon rose, message below in rose.

### Navigation
Fixed tab bar on Slate Surface with a top hairline; five columns, 11px Onest labels in Mist, the active tab and its icon in neon lime. The centre column is the 56px lime + button, raised 16px and ringed in the ground colour.

### Wallet (signature)
A horizontal, snap-scrolling rail of real-proportion cards, one per account, ordered by most available. Each card is filled in its owned wallet colour with two faint concentric circles in the ink colour (10% and 7%), the name and date pill on the top row, a drawn chip under the name on the left (cards and KMH only), the available figure, a 5px track filling in the ink colour, a meta line naming what the figure is and the limit ("Kullanılabilir · 60.000 ₺ limit", "KMH kullanılabilir · …", "Banka bakiyesi", "Nakit"; no kind label above the name), and the date pill (urgent dates invert to ink background, card-colour text). Inactive cards rest at 0.94 scale and grow to full size when active (0.45s exponential). Pressing a card shrinks it to 0.98. Below the rail, 6px dots as a non-interactive position indicator (the cards themselves are the controls); the active dot stretches to 18px in Moon Ink. A snap to a new card gives an 8ms haptic tick where supported. At 360 px the figure steps down to the figure size (clamp 1.5–1.75rem) and the card padding to 16/18px. The last slide is a dashed add-card with a lime + medallion.

### Spending spread
A 14px bar under the hero figure, one pill segment per account in its wallet colour, 3px gaps, widths proportional to what each account contributes. Segments scale in from the left, staggered 60ms.

### Runway panel (signature)
A 28px-radius slate panel ("Kesime kadar") holding a scrubbable plot (role=slider, pointer and arrow keys). The cyan line steps down at each event; recurring marks are cyan dots, due dates are hollow rings, the kesim is magenta. The selected day is a 16px magenta dot with a panel-coloured gap and a magenta halo, with a dashed cursor; the readout above names the day and the figure that remains, with event chips below on a faint translucent track. On load the line draws left to right over 1.1s and markers pop in after it.

### Payment row
A 16px row tinted 10% toward its account's wallet colour with a 22% border, led by a 52px date tile in the full wallet colour (day in display 800, month caption). Figure right, status pill below. Shrinks to 0.985 on press.

### Status notes
Full-width 16px-radius notes on a semantic wash: Lime Moss for "cash left after payments", rose wash when short (the shortfall figure in rose), amber wash for recurring payments due today with a round slate icon medallion and a chevron.

### Motion
One load moment per visit: the hero figure rises 10px out of a 6px blur (0.8s), spread segments and wallet cards stagger in, limit fills grow from zero, the runway draws. Everything uses the exponential ease-out (`cubic-bezier(0.16, 1, 0.3, 1)`); small state changes use the standard ease (`cubic-bezier(0.2, 0.7, 0.2, 1)`) at 0.1 to 0.2s. All of it is off under reduced motion.

## Do's and Don'ts

### Do:
- **Do** give every account its wallet colour by creation order and repeat it on every surface where that account appears (The Owned Colour Rule).
- **Do** put near-black ink on green, yellow and cyan wallet colours, and white ink on the rest.
- **Do** reserve neon lime for actions, focus, the active place and the free-limit fill.
- **Do** set every money figure in Schibsted Grotesk with the ₺ in Onest at 0.62em.
- **Do** make every tappable surface shrink slightly on press (0.98 for buttons and cards, 0.985 for rows and notes).
- **Do** keep neutral surfaces shadowless in dark; let wallet cards glow only in their own colour.
- **Do** run motion once on load with exponential ease-out and turn it off under reduced motion.
- **Do** keep both themes readable; light keeps the same wallet colours on a white ground.
- **Do** bring Harcamalar, Takvim, Ayarlar and the sheets onto this world as they are migrated, using these tokens and components rather than new ones.

### Don't:
- **Don't** use violet panels or accents, a warm peach ground, or grey stone with an evergreen accent; the user rejected each.
- **Don't** build themed costume worlds (road signs, boarding passes, transit boards, calendars, banknotes) or anything that reads as a bank app.
- **Don't** fall back to a grey list of white rows; accounts are coloured cards.
- **Don't** use the runway cyan or magenta tokens outside the runway panel, fill a card or tile with a category colour, or use lime for any data other than free limit.
- **Don't** add uppercase or tracked-out labels above headings; headings stand on their own in sentence case.
- **Don't** let the display face draw the ₺ sign.
