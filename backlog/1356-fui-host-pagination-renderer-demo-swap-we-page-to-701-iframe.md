---
kind: story
size: 5
parent: "1353"
status: open
blockedBy: []
dateOpened: "2026-06-20"
tags: []
---

# FUI-host pagination renderer demo, swap WE page to #701 iframe, delete we:blocks/renderers/pagination

Build fui:demos/pagination-demo.html self-bootstrapping the (complete) FUI pagination renderer; swap we:demos/pagination-demo.html to a #701 fuiDemo iframe; delete we:blocks/renderers/pagination + we:demos/pagination-demo.{ts,css}. #1326 pattern.

## Pre-flight note — unmet build precondition; re-sized 3 → 5 (batch-2026-06-20-1344-1342)

Same finding as sibling #1355: `fui:demos/pagination-demo.html` does **not** exist yet, so this bundles
building + browser-verifying a self-bootstrapping FUI demo (the #1312-analog the #1326 size-3 precedent had
as a *separate* prior item) with the delete+swap. Recommend splitting the demo build into its own prereq
and making this the delete+swap `blockedBy` it; needs a focused session with the FUI dev server for live
render verification before deleting the WE source.

## Re-scope from #1467 ruling (ratified 2026-06-21 → b)

Delete confirmed **but bounded by #899's vector-conformance split** — impl → FUI, not a clean wipe:

- **Leave in WE:** the pagination assertion-semantics **verifier** + the pagination vector corpus + the
  contract **types** (incl. `PageState`). WE conformance asserts the **stored golden output** (data).
- **Move to FUI:** the runnable pagination backend (`renderPagination` + its compute).
- **No coordinator-import precondition (unlike #1355):**
  `we:blocks/renderers/collection-operations/CollectionOperationsBehavior.ts` imports `PageState` from
  `../pagination/renderPagination` as a **type-only** import — types stay in WE, so no value re-home blocks
  this card. Keep the `PageState` type in the WE contract plane when the runtime renderer moves.
