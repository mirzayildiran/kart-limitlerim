# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Installable PWA, mobile-first (360–430 px target). The planned App Store and Google Play builds (Capacitor) wrap the same web design language; they do not adopt per-OS native styling.

## Users

People in Turkey who juggle several credit cards, a KMH (overdraft account) and some cash, and want to know before a purchase or near a statement date whether they can afford it. They open the app on their phone, often right after checking a banking app, and want a single trustworthy number rather than a ledger. The live GitHub Pages build is for this general public now, not only for the author.

## Product Purpose

Kart Limitlerim answers "how much can I actually spend right now, and what will I have left until the next statement?" instead of the usual "how much do I owe?". Success means the user trusts the home number enough to act on it, understands what minimum payments and recurring payments will take before the next statement, and sees what paying only the minimum will cost in interest.

## Positioning

Two things set it apart, and they carry equal weight:

1. **Spending power, looking forward.** Free limit across every card, KMH and cash in one figure ("Şu an harcayabileceğin"), then the same figure after recurring payments up to the next statement ("Kesime kadar"), and cash after minimum payments.
2. **Interest made visible.** Estimates of the interest that lands on the next statement if only the minimum is paid (akdi faiz, KKDF, BSMV included), plus running interest per card and daily KMH interest.

All of this runs entirely on the device: no account, no server, no tracking, no bank password or card number ever requested. Screenshot import reads bank-app screenshots with on-device OCR and never uploads or keeps the image.

## Operating Context

- Used alongside the user's own banking apps: they read limits and transactions there, then update or import here.
- Card cycles drive everything: statement date (kesim), due date (son ödeme), minimum payment (asgari ödeme), instalments (taksit), recurring payments (düzenli ödemeler).
- Screenshot import has a confirmation step: every row is reviewed, payments and refunds are excluded, duplicates are flagged, and by default the import does not reduce available limit, since the bank app already shows it reduced.
- Data portability is a JSON backup export/import.

## Capabilities and Constraints

- Shipped: cards, KMH, cash and accounts sorted by available limit; statement and due-date calendar; minimum-payment tracking; expenses with user-made categories and instalments; recurring payments; interest estimate with per-card rate override; on-device OCR import (recognised banks: Ziraat Dinamik, Ziraat Bankkart, Akbank, İş Bankası, Garanti, plus a generic fallback parser); JSON backup; light and dark themes; offline use.
- Planned (see `docs/ROADMAP.md`): remotely updatable rate table, OCR preprocessing in a Web Worker, Android Web Share Target, Capacitor store builds, Face ID / fingerprint lock, due-date reminders, a "which card should I use?" suggestion, instalment limit calendar, home-screen widget.
- Technical: Preact + TypeScript + Vite, vite-plugin-pwa, IndexedDB via idb, Tesseract.js with bundled Turkish data, @preact/signals. Money is always integer kuruş, formatted only via `src/domain/money.ts`. Dates are local calendar days.
- Interest and minimum-payment figures are **estimates** based on published TCMB and BDDK rules (sources dated in `src/domain/rates.ts`); the bank statement is authoritative. The app gives no financial advice and must never present estimates as exact.

## Brand Commitments

- Name: **Kart Limitlerim**. App icon in `public/icons/`.
- Language: Turkish, addressing the user as "sen". Plain, action-stating copy ("Kaydet", "Harcama eklendi"). Error messages say what happened and what to do next.
- Privacy is a promise in the product's own words: data stays on the device, credentials are never asked for.
- Visual stance (user, 2026-10-10): professional and pleasing to the eye, clearly different from other finance apps, warm enough that people take to it on first open. No themed metaphors or costume worlds (road signs, boarding passes, transit boards, calendars, banknotes were all rejected). Must not look like a bank app.

## Evidence on Hand

- OCR accuracy: in a test on real screenshots, 28 of 29 rows were read correctly across five banks (`docs/ROADMAP.md`, README).
- Rate sources: TCMB/BDDK references with dates in `src/domain/rates.ts`.
- Docs: `README.md`, `docs/ARCHITECTURE.md`, `docs/PRIVACY.md`, `docs/ROADMAP.md`, `CHANGELOG.md`.
- No testimonials, user counts, press, ratings or store listings exist. Do not invent them.

## Product Principles

1. **One number you can act on.** Lead with what the user can spend, and show how it was calculated so they can trust it.
2. **Look ahead to the next statement.** Every figure should help answer "what happens between now and the statement date?"
3. **Show the cost of the minimum.** Make interest consequences concrete, and always label them as estimates.
4. **The device is the vault.** No accounts, no uploads, no credentials, and no feature that weakens this.
5. **Confirm before it counts.** Automated input (OCR, imports) is always reviewed by the user before it changes any balance.

## Accessibility & Inclusion

- Touch targets at least 44 px; every control has a visible label or `aria-label`; enforced by eslint-plugin-jsx-a11y.
- Light and dark themes must both be readable.
- Amounts use tabular numerals; Turkish number and currency formatting throughout.
