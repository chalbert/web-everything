---
kind: story
size: 5
parent: "1522"
locus: frontierui
status: resolved
dateOpened: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: "fui:tools/explorer/cli.ts — newContext page fix + settle() + a11y-read-failed oracle"
tags: []
---

# Explorer CLI misses a11y findings present on the page (observe before settle / silent axe-catch)

The CLI reports 'No Layer-1 findings' on pages with known axe violations (plateau /home has 5 color-contrast failures the harness found with the SAME collector). exploreAndAudit observes each state immediately with no quiescence wait, so axe runs before async-rendered content mounts; and playwrightCollector #axeViolations swallows any axe error to []. Net: the tool silently under-reports. Add a settle/quiescence wait before observe and surface axe failures instead of returning [].

## Evidence (2026-06-22)

`node fui:tools/explorer/cli.ts -- http://localhost:4000/home` → "✅ No Layer-1 findings" (3 states), yet the bespoke harness (`fui:tools/explorer/plateau-audit.ts`) found 5 `color-contrast` violations on the same `/home` using the same `PlaywrightObservationCollector`. The only difference: the harness waits for `networkidle` + a short settle before `observe()`; `fui:tools/explorer/exploreAndAudit.ts` calls `observer.observe(stateId)` with no quiescence wait, so axe samples a state before plateau's rAF-polled mounts render. Two general fixes (both app-agnostic): (1) a settle/quiescence wait before observe in the explore loop; (2) `#axeViolations` in `fui:tools/explorer/oracles/playwrightCollector.ts` should surface an axe failure (a finding / log) rather than silently returning `[]`. This is the highest-priority autonomy gap — the tool currently **under-reports silently**, the worst failure mode for "find all issues unattended."

## Resolved (2026-06-22) — true root cause was a swallowed axe error, surfaced by the fix

Surfacing the error (fix 2) immediately revealed the real cause, which the silent catch had hidden: `fui:tools/explorer/cli.ts` created its page with `browser.newPage()`, and `@axe-core/playwright` **rejects** a default-context page ("Please use browser.newContext()"). So axe threw on every state and the collector returned `[]` — the a11y oracle silently never ran. The harness worked only because it used `browser.newContext().newPage()`.

Shipped (all app-agnostic, validated on two structurally different apps — plateau `/home` and the FUI docs site `:8082`):

- **Root-cause fix:** `fui:tools/explorer/cli.ts` now creates the page via `browser.newContext().newPage()`. plateau `/home` now reports `color-contrast` (5/8/2 nodes) instead of "No findings"; the FUI docs site surfaces contrast + clipped-residue + console/5xx errors.
- **Surface, don't swallow:** `#axeViolations` in `fui:tools/explorer/oracles/playwrightCollector.ts` returns the error; new `a11y-read-failed` warn oracle (`fui:tools/explorer/oracles/genericInvariants.ts`) flags "results may under-report" — so a future broken read is loud, never silent. New `a11yError` field on `Observation`.
- **Settle before observe:** optional `settle()` on `ExplorerDriver` (`fui:tools/explorer/explorer.ts`), implemented on the Playwright adapter as bounded `networkidle` + a 2-frame flush (`fui:tools/explorer/playwrightDriver.ts`), called after seed/replay/fire — so axe samples async (fetch/rAF) content after it mounts, on any app.
- Tests updated/added (`fui:tools/explorer/oracles/__tests__/genericInvariants.test.ts`); full explorer suite green (86).

Remaining for a full unattended audit (separate slices): auth-gated reach #1523, whole-app sweep #1524, `--out` report bundle #1525.
