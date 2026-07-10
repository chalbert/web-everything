---
kind: story
size: 3
parent: "777"
status: resolved
dateOpened: "2026-07-09"
dateStarted: "2026-07-10"
dateResolved: "2026-07-10"
graduatedTo: "#2164 (impl-first fix) + verification"
tags: []
---

# Fix the 5 enforced-route a11y regressions on the WE-docs gate

The a11y gate's enforced lane is red now: /, /adapters/, /blocks/, /intents/, /protocols/ all fail [serious] color-contrast (plus one nested-interactive on /) — all five are the SSR we-card index tiles converted in #2019 and siblings, which regressed the earned enforce posture unnoticed. Fix the tile contrast + the nested-interactive so the enforced lane goes green. NOT blocked by #867 (red under the already-ratified posture); re-measure before fixing since route lists are from 2026-07-02.

## Resolution (2026-07-10)

Re-measured per the item's own instruction before touching any code. Both underlying defects
were **already fixed** by #2164 (resolved 2026-07-03, one day after this item's stale
2026-07-02 route-list snapshot):

1. **Badge `--tone-warning` contrast** — `frontierui:blocks/badge/Badge.ts:95` fallback is
   `#8a5d00` (4.90:1), and the WE mirror `we:src/css/style.css:1762` carries the identical
   `#8a5d00` — confirmed by direct read of both files on current `origin/main`, no drift.
2. **Nested `<button>` on `/`** — the #2168 home-grid rework already sentinel-splices the short
   authored `summary` (not the raw HTML `description`), so no live nested `<button>` is
   materialized.

Verification performed fresh in this session: full `npm run build:docs`, then
`npx playwright test --project=chromium tests/a11y` — **all 42 routes pass (10 enforced +
32 warn-only)**, including all 5 named here (`/`, `/adapters/`, `/blocks/`, `/intents/`,
`/protocols/`). Re-ran the 10 enforced-only tests in isolation as a second confirmation — same
result, 10/10 green.

No code changes were needed in either repo (WE or FUI) — this item closes as a
verify-and-document pass on top of #2164's already-landed fix. The "red now" reading in the
original description was itself a stale artifact (this item was opened 2026-07-09, six days
after #2164 landed, but evidently against an unrefreshed measurement — the same failure mode
#2164 diagnosed for its own initial "5 red routes" report).
