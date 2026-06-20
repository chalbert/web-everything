---
kind: story
size: 5
parent: "658"
locus: frontierui
status: resolved
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: none
tags: []
---

# Author and host FUI demos for the migrated block-impl families as fuiDemo iframe targets

Prerequisite for #697's WE-side cutover. WE's fuiDemo shortcode (we:.eleventy.js:38) iframes FUI_DEMO_BASE/demos/<file>, but FUI's demos/ hosts NO demo for the 9 migrated block-impl families (background-task-surface, data-grid, type-ahead, audit, lifecycle, master-detail, selection, stepper, tree-select) — so every cutover iframe points at a 404 today. Author + host a runtime demo per block-impl family in frontierui/demos/ (locus:frontierui), serving on :3001 / the published demos host, so WE can swap block.fuiDemo to the FUI-hosted file and delete its local demo. Scope = the standalone block-impl demos (background-task-surface-demo, data-grid-demo, durable-tier surface); the exercise-app composition path is the separate #812 fork. Blocks the #697 cutover.

## Resolution (2026-06-16)

Ported the standalone block-impl demos + their shared harness into `frontierui/demos/` as
byte-identical copies (the iframe-boundary copy pattern; the demos' `/blocks/…` + `/demos/…` absolute
imports resolve against FUI's tree unchanged, and FUI demos already carry "Web Everything" titles):

- `we:playground-harness.ts`, `we:playground.css` — shared conformance infra (still WE-resident for the 17
  other WE playgrounds; copied, not moved).
- `background-task-surface-demo.{html,css,ts}` — drives a real `<background-tasks>` via the migrated
  `__fixtures__/mock-loader`.
- `data-grid-demo.{html,css,ts}` — APG Data Grid renderer + edit sub-pattern; all deps (`renderers/
  data-grid`, `data-grid/DataGrid*Behavior`, both `__fixtures__`) already migrated into FUI.
- `durable-tier-verification/{we:index.html,we:durable-tier-verification.ts,we:durable-sw.js}` — the durable
  surface (A′ / #708).

**Verified on FUI :3001 (real browser, Playwright):** bg-task **5/5** invariants green, data-grid
**18/18** green (`playgroundReady=true`, zero fail badges), durable page loads with zero console/import
errors. FUI `check:standards` green (0 errors). The other 7 families have no standalone demo (surfaced
only via the exercise-app composition path, the separate #812 fork) — nothing to author here.

**WE-side swap + local-demo deletion stays with #697.** Coverage leftover filed as **#816** (FUI lacks
a playground e2e + `chromium-sw` lane for the hosted demos; WE's specs that cover them today are
orphaned at #697 deletion) — #697 re-pointed to `blockedBy: ["816"]`.
