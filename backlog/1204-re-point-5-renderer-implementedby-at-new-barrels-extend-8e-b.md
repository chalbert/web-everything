---
type: idea
workItem: story
size: 2
parent: "904"
status: resolved
blockedBy: ["1203"]
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: src/_data/blocks/collection-operations.json
tags: []
---

# Re-point 5 renderer implementedBy at new barrels + extend 8e barrelBlocks filter + gen:cem

Per the #1164 ruling (B), slice 2: re-point each renderer block's implementedBy in its `we:src/_data/blocks/` spec from the dir-style ref to the new per-dir barrel (one per renderer, e.g. `fui:blocks/renderers/data-table/index.ts`), extend the 8e barrelBlocks filter in we:scripts/check-standards.mjs:824 so the 5 renderers ride the uniform getExportsOfModule TS-program path, and regenerate the CEM (gen:cem). Closes the contract→barrel drift direction. blockedBy #1203 (barrels must exist first).

## Delivered (batch-2026-06-20-1212-1213-1214-1216-1217)

Cascade-freed by #1203 (the barrels). All 5 renderer `implementedBy` now point at their per-dir barrel files (data-table/pagination/data-grid were repointed during #1230/#1203; this slice repointed the remaining `we:src/_data/blocks/collection-operations.json` + `we:src/_data/blocks/reorderable-list.json`). All 5 renderers now ride the 8e export-shape arm and **pass** (declared `exports` ⊆ barrel surface); the un-coverable set dropped 35→30.

- **8e `barrelBlocks` filter:** no change needed — `we:scripts/check-standards.mjs` already filters generically on an `implementedBy` ending in a barrel file + non-empty `exports`, so repointing alone enrolls the 5 renderers in the uniform `getExportsOfModule` TS-program path (verified: the gate now resolves + checks all 5).
- **`gen:cem`:** regenerated `we:custom-elements.json` (80 block modules, schema 2.1.0). The regen also synced pre-existing CEM staleness from other (already-committed) block sources — the generated artifact now matches committed data; no semantic block changes were made here beyond the 2 renderer repoints.

Closes the contract→barrel drift direction for the renderer family; with #1203 (barrels) + #1229/#1230 (names) this clears the renderer-block export-shape findings (#1218), a prerequisite to flipping `EXPORT_SHAPE_ENFORCED`.
