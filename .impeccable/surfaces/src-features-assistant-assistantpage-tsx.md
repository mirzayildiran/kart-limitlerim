---
version: 1
slug: "src-features-assistant-assistantpage-tsx"
primary_target: "src/features/assistant/AssistantPage.tsx"
related_targets: ["src/features/assistant/BudgetPlan.tsx", "src/features/assistant/ChatPanel.tsx", "src/features/assistant/ConsentPanel.tsx", "src/features/home/HomePage.tsx", "src/domain/insights.ts"]
---

# Bütçe asistanı surface brief

Scope: the assistant route (`#/asistan`) and its entry from Özet. Mode: Operate. Inherits the Özet world (DESIGN.md); no new tokens. Built in a separate session (`claude/budget-assistant`), merged 2026-10-10; this pass brings it into the world. Lead decisions under owner delegation.

Audience and job: the user wants to know what needs attention in their money this month and, optionally, to talk a plan through. Success: the most urgent item is understood in one glance, every suggestion names the account it concerns, the budget plan is easy to set, and the chat is clearly optional and private by default.

## Direction contract

THESIS: The wallet, explaining itself. Suggestions read like Takvim's agenda: one slate container, rows led by the account's own colour, urgency carried by the amber/rose tokens rather than labels. Rejects the incumbent's stack of same-size cards and the "Dikkat"/"Öneri" pills above each heading (craft floor: identical card stacks; kicker above a heading).

OWN-WORLD: Özet's world unchanged. Account colour fills the medallion of an account-specific suggestion (Owned Colour Rule); suggestions without an account use a slate medallion with a drawn icon. Amber for `warn`, rose for `crit` — on the medallion ring and a small pill at the row end only when a deadline is involved; `info` has no colour of its own. Lime only for actions ("Kategori için hedef ekle", "Sohbeti aç").

STORY: header → what needs attention (crit, warn first) → other suggestions → this month and the budget plan → optional chat → disclaimer.

FIRST VIEWPORT (360×780): back + title + one-line intro; the first three suggestion rows.

FORM:
- **Header:** back button (44 px, `Icon back`, ink colour not lime — navigation is not an action), title h1, intro caption.
- **Suggestions ("Öneriler"):** h2 + count caption right ("7 öneri"). One slate container, hairline rows (≥56 px): 36 px medallion (account colour via `data-slot` → `--c`/`--c-ink`, or slate `--surface-3` + `--muted` icon when no account) with a kind icon (`alert` for due/limit, `card` for interest on a card, `wallet` for spending pace, `bank` for KMH, `info` otherwise); title (body-strong) and body (text-sm, muted, up to 3 lines); severity: `crit` → 2 px rose ring around the medallion, `warn` → 2 px amber ring; no pill above the title. Rows ordered crit → warn → info (existing order kept within a level). Footer caption under the container: "Öneriler cihazında hesaplanır, internete bağlanmaz."
- **Insight model:** add optional `accountId?: string` to `Insight` (`src/domain/insightsTypes.ts`) and set it in `src/domain/insights.ts` wherever the insight concerns one account (the id already encodes it); tests updated.
- **Bütçe planı:** keep content; the month figure uses `Amount size="xl"`; "Ay sonu tahmini" and "Geçen ay toplam" as a two-row definition list with figures right (display face, tabular via `figure()`); helper sentence and "Kategori için hedef ekle" (secondary, `Icon plus`) unchanged in meaning.
- **Sohbet:** when the proxy URL is missing, one quiet row "Sohbet bu sürümde kapalı. Öneriler yine de çalışır." (no card-in-card). When available: ConsentPanel and ChatPanel keep their behaviour; visual alignment only (slate groups, lime primary, rose only for errors).
- **Disclaimer:** caption, centred, "Tahmindir, finansal tavsiye değildir."
- **Entry from Özet:** the existing status line under the greeting (`home-status` in `HomePage.tsx`) becomes a button (≥44 px) that opens `#/asistan`: it keeps its current text and tone dot and gains, at the end, "· N öneri" when the assistant has more than one suggestion, plus a 16 px `chevron`. When there is no status text, it shows "Bütçe asistanı · N öneri" in muted ink if N > 0, otherwise nothing. No new block on Özet.
- **Motion:** press language only.

FINISH: critique on captures, fix round, finish reviewer verdict, DESIGN.md Rollout status updated.
