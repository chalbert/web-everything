---
kind: story
size: 3
status: resolved
blockedBy: []
relatedDecision: 1748
dateOpened: "2026-06-24"
dateStarted: "2026-06-24"
dateResolved: "2026-06-24"
graduatedTo: none
tags: []
---

# Stand up the WE-docs FUI badge/filter-chip loader (cross-origin, rule-7)

Build the #1748-ratified loader: FUI serves a small `fui:embed/badges-in-document.ts` entry that calls registerBadge()+registerFilterChip() and injects the exported CSS once; WE adds a second guarded cross-origin import(...) of that served entry in `we:src/_layouts/base.njk` (mirroring the #865 chrome shell at :418) plus a `we-badge{}`/`we-filter-chip{}` SSR baseline to kill the upgrade flash. Boundary-legal runtime URL bundle (rule 6), zero new infra (reuses the live frontierUrl origin). Unblocks #1598's docs-pill migration.

## Progress

- **Status:** done.
- **Done:**
  - FUI: `fui:embed/badges-in-document.ts` exports `registerBadgesInDocument(doc?)` — calls
    `registerBadge()` + `registerFilterChip()` and injects `BADGE_CSS + FILTER_CHIP_CSS` once into
    `document.head` (guarded by `#fui-transient-badge-styles`, idempotent). Barrel-exported in
    `fui:embed/index.ts`; added to the `fui:vite.config.mts` rollup input so prod emits a stable
    `fui:embed/badges-in-document.js`. Unit test `fui:embed/__tests__/badges-in-document.test.ts` (3, green).
  - WE: second guarded cross-origin `import(...)` of the served entry in `we:src/_layouts/base.njk`
    (after the #865 chrome-shell loader at :418), `.then((m) => m.registerBadgesInDocument())` with a
    silent `.catch()` degradation. `we-badge{}` / `we-filter-chip[tone|selected]` SSR baseline added to
    `we:src/css/style.css` (tracks the FUI palettes; keep-in-sync note inline).
  - Verified in a real browser against the live docs (`:3000/backlog/`): cross-origin import runs →
    both elements defined + stylesheet injected; un-upgraded `<we-badge>` styled as a pill by the SSR
    baseline (inline-flex / 999px / tone bg); `<we-badge tone="success" status>` upgrades in place to
    `<span class="fui-badge fui-badge--success" role="status" aria-label="success: Healthy">` with the
    injected success tone applied. No console errors.
  - Gates green: FUI vitest (embed + new test), WE `check:standards` (0 errors), 11ty `build:check`.
- **Next:** none — #1598 (docs-pill migration, `blockedBy` this) is now unblocked.
