---
kind: story
size: 5
parent: "777"
status: open
dateOpened: "2026-06-17"
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
