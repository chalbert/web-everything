---
kind: story
size: 13
parent: "777"
status: open
dateOpened: "2026-06-17"
dateStarted: "2026-06-22"
tags: []
---

# Migrate WE-docs page-level UI to FUI components (tiles/tables/badges/code-frame)

Replace catalog tiles/cards, tables, badges, and code-sample surfaces across src/*.njk with FUI component impl, mounted via the mode-C SDK. Follows the chrome migration slice (#865) and reuses its mount pattern + theme bundle (#864).

## Unparked 2026-06-22 — FUI page-UI block impls now exist

The 2026-06-18 pre-flight parked this because `fui:frontierui/blocks/` had none of
the needed page-UI impls (only `data-table`). That blocker is now cleared — epic **#904** (resolved)
delivered the set: `blocks/badge`, `blocks/card` (the generic tile primitive, covers tiles/catalog-tiles),
`blocks/code-view` (covers code-frame/code-sample, #924), and `blocks/renderers/data-table`. The mode-C
mount pattern (#865) and theme bundle (#864) are also resolved. No `blockedBy` edge — its dependency was
#904, now done. Claimable as a batch slice.

Residual: there is no dedicated `tile`/`catalog-tile` block — those map onto `card`. If the docs catalog
needs a literal tile distinct from `card`, that's a *new* FUI component, not a blocker on this migration.

## Pre-flight (batch-2026-06-22-1581-1582-1576-1355-1531) — surface is site-wide, NOT a size-5 slice → size 5 → 13, needs /slice

The build precondition IS clear (FUI infra exists: #904's `card`/`badge`/`code-view`/`data-table` blocks all
export `mountInDocument`; the mode-C `fui:embed/in-document.ts` SDK + the #865 chrome precedent
(`we:src/_data/chrome.js` → `@frontierui/embed/chrome-in-document`) are landed) — so there is **no blocker**.
But grounding the **scope** shows "across `src/*.njk`" is **site-wide**, not one bounded slice:

- `<table>`/`data-table` surfaces: **~225** `.njk` files
- `<pre>`/code-sample/code-frame surfaces: **~182** `.njk` files
- `badge` surfaces: **~25** `.njk` files
- catalog-tile/card surfaces: ~20+ pages (`we:src/intents.njk`, `we:src/blocks.njk`,
  `we:src/design-systems.njk`, the `we:src/_includes/project-*` includes, …)

Migrating every one to a mode-C FUI mount point + render-verifying each on the :8080 docs build is far
beyond a size-5 batch slice (the same too-big pattern as #1576). **Re-sized 5 → 13; needs /slice.**
Recommended slicing **by surface type** (each independently deliverable + render-verifiable): (a) badges
(~25, smallest — the natural first slice), (b) catalog tiles/cards, (c) code-sample/code-frame, (d) tables
(largest). Each slice migrates its surface across the docs, dogfooding the corresponding #904 FUI block via
the #865 mount pattern, and gates on `npm run verify` + a :8080 render check. Carry-forward reason:
**not-batchable** (needs /slice — site-wide surface).
