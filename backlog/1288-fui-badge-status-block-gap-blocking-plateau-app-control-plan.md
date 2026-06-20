---
kind: story
size: 2
locus: frontierui
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "fui:blocks/badge/Badge.ts"
tags: [fui, gap, dogfood, plateau-app]
---

# FUI badge/status block — gap blocking plateau-app Control Plane dogfood

FUI has no badge/status-indicator block (data-grid covers tables, but no badge). The #1254 plateau-app dogfood found its Control Plane dashboard (we:plateau:src/control-plane/dashboard.ts) hand-rolls status badges, so that surface is could-not-split until FUI ships a badge. Per first-party-dogfood, file the gap. locus: frontierui. Unblocks the Control Plane migration slice once shipped.

## Progress

Shipped the FUI badge/status-indicator block, closing the gap that blocked the plateau Control Plane
migration slice (#1254):

- `fui:blocks/badge/Badge.ts` — `createBadge`/`mountBadge`/`setBadgeTone`/`mountInDocument` config factory
  (same shape as the #870 button block — no global tag, #841 still open). Five tones
  (neutral/info/success/warning/error); operational-status badges get `role="status"` + a tone-prefixed
  `aria-label` (meaning never colour-only). `BADGE_CSS` exported for composing hosts. Satisfies the
  `EmbedMountModule` mode-C contract.
- `fui:blocks/badge/index.ts`, `fui:blocks/__tests__/unit/badge/Badge.test.ts` (8 tests green),
  `fui:demos/badge-demo.html` (mode-C showcase + live `setBadgeTone` flip), `fui:src/_data/blocks.json`
  (registered: type Module, demoFile badge-demo.html).

Verified at :3001 (Playwright): the mode-C showcase mounts 5 tone badges in a shadow root, the status
badge's `aria-label` is "success: Healthy", zero console errors. FUI `check:standards` clean for badge
(40 blocks registered, demo resolves); red only on the 2 pre-existing notification/signature-pad catalog
errors (unrelated, stepped over). The plateau Control Plane swap onto `createBadge` is the follow-on
#1254 slice.
