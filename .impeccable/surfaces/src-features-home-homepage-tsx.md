---
version: 1
slug: "src-features-home-homepage-tsx"
primary_target: "src/features/home/HomePage.tsx"
related_targets: []
---

# Özet (home) surface brief

Scope: the Özet tab (src/features/home). Mode: Operate. First surface of a redesign; the visual system established here later spreads to Harcamalar, Takvim, Ayarlar and the sheets.

Audience and job: a Turkish card user opens the app on their phone, often right after a banking app, to decide whether they can afford something and what is left until the next statement. Success: they read one number they trust and see how it changes until the kesim date.

Constraint from the user: professional, eye-pleasing, warm, different from other finance apps; no themed metaphors; must not look like a bank app. The tab bar, + button, and existing flows stay.

## Direction contract

THESIS: A colourful, alive wallet. Every account is a real card in its own vivid colour, swiped like a wallet; the spending power above is split into those same colours, and a night-violet runway panel shows the number falling until the kesim date. Rejects the category's grey list of white rows (round 1 of this redesign was rejected by the user as "klasik, boş").

OWN-WORLD: Dark by default (user choice: "koyu tema + neon parlak renkler"; warm peach ground and violet accents were rejected). Near-black ground, slate surfaces, neon lime as the action colour (+ button, active tab), neon cyan runway line with magenta selected day. Seven neon wallet colours (orange, electric blue, magenta, green, hot pink, yellow, cyan) owned per account by creation order and repeated wherever that account appears; bright ones (green, yellow, cyan) carry dark ink. Category colours from their hue at neon saturation. Light theme stays available in Settings: white ground with the same wallet colours. Schibsted Grotesk figures, Onest text, sentence case.

STORY: See what you can spend and which accounts it comes from, swipe through your cards, scrub the runway to see any day until kesim, see plainly whether cash covers the minimums, then the payments and this month's spending.

FIRST VIEWPORT: Greeting and date; "Harcama gücün" and the figure at ~76px; a 14px spread bar in account colours; the wallet carousel (card at 80% width, card proportions 1.586, next card peeking) with dots; the top of the runway panel. Tab bar and + unchanged.

FORM: User-pinned own world (seed 57a8a444 rerolled once, then both rejected; round-1 build rejected). Signature interactions: wallet swipe with snap, active card full size and the rest scaled 0.94; runway scrub (pointer and keys, role=slider). Motion grammar: one load moment (figure rise-in, spread segments and cards staggering in, limit bars filling), exponential ease-out, off under reduced motion.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Finish record (2026-10-10)

Dual-agent critique 22/36 → three fix rounds → finish reviewer `disposition: ship` (covers the scored fixes). Accepted adaptations: the available label sits in the card's meta line under the track; runway magenta stays user-pinned and is separated from the wallet magenta slot and category colour by shape (DESIGN.md Owned Colour and Runway Pair rules). Carried to the sheets surface: figure and name duplication in the account detail sheet. Deferred to the onboarding pass: empty-state (welcome) improvements.
