---
kind: story
size: 5
parent: "1353"
status: open
blockedBy: ["1566"]
dateOpened: "2026-06-20"
dateStarted: "2026-06-22"
tags: []
---

# FUI-host data-table renderer demo, swap WE page to #701 iframe, delete we:blocks/renderers/data-table

Build fui:demos/data-table-demo.html self-bootstrapping the (complete) FUI data-table renderer; swap we:demos/data-table-demo.html to a #701 fuiDemo iframe; delete we:blocks/renderers/data-table + we:demos/data-table-demo.{ts,css}. #1326 pattern.

## Pre-flight note — unmet build precondition; re-sized 3 → 5 (batch-2026-06-20-1344-1342)

Skipped in-batch: this is **not** the clean size-3 delete+swap the #1326 precedent was. #1326 (size 3) only
deleted+swapped because its self-bootstrapping `fui:demos/view-tabs-demo.html` **already existed** — it was
built first as the *separate* landed item #1312. Here `fui:demos/data-table-demo.html` does **not** exist
yet (no data-table demo under `fui:demos/`), so this card bundles building a self-bootstrapping FUI
demo that faithfully reproduces the 216-line `we:demos/data-table-demo.ts` + browser-verifying it renders,
**then** the swap + delete. Recommend splitting the demo build (the #1312-analog) into its own prereq and
making this card the delete+swap `blockedBy` it; both need a focused session with the FUI dev server for
live render verification before the WE source is deleted.

## Re-scope from #1467 ruling (ratified 2026-06-21 → b)

The delete is confirmed **but bounded by #899's vector-conformance split** (the [constellation-placement](docs/agent/platform-decisions.md#constellation-placement) rule) — impl → FUI, not a clean wipe:

- **Leave in WE:** `auditDataTable` (the assertion-semantics **verifier** = #899's WE gate) + the vector
  corpus `we:blocks/renderers/data-table/__fixtures__/data-table-cases.ts` + the contract **types**. The WE
  conformance suite asserts the **stored golden output** (data), no live WE render.
- **Move to FUI:** the runnable backend `renderDataTable`/`cellContent`/`cellDisplayText` + the backend
  semantics `applyPipeline`/`aggregate`/`summaryText`/sort-state/`announce`.
- **Precondition:** `we:blocks/renderers/collection-operations/CollectionOperationsBehavior.ts` value-imports
  `applyPipeline, aggregate` from this renderer — its re-home to FUI is a **separate prereq slice** (filed
  per #1467); this card is `blockedBy` it, since the import must move before the renderer can leave WE.

## Pre-flight (batch-2026-06-22-1545-1549) — demo+move DONE; bounded delete surfaced a fork → `blockedBy: 1566`

Claimed + ground the current state: the demo-build (`fui:demos/data-table-demo.html`) **already exists**, the
FUI renderer move (`renderDataTable`) **is done**, and the collection-operations precondition (its
`applyPipeline`/`aggregate` import) is **gone** — so the only residual is the **bounded delete + iframe
swap**. But grounding the delete surfaced a genuine unresolved fork (filed as **#1566**): WE's verifier
`auditDataTable(root, golden)` lives **in** `we:renderDataTable.ts` and needs a rendered root the renderer
produces; the WE conformance test renders via the backend in all three sections (golden audit, drift guard,
interactive); and the verifier has **diverged** (FUI ported `auditDataTable(table, rows, config)`). The
#1467 ruling fixed the boundary, not the mechanism. Completing the delete needs a design choice (stored-root
fixture / golden-JSON-only / reconcile verifiers / move auditDataTable) — not forced here. `blockedBy: 1566`;
released. Carry-forward reason: **not-batchable** (fork).
