---
kind: story
size: 2
parent: "1245"
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "fui:blocks/data-transfer/DataTransferZoneElement.ts"
tags: []
---

# Delete WE blocks/data-transfer runtime copy (FUI canonical)

Delete we:blocks/data-transfer/ — the WE runtime copy of an already-FUI-canonical block. Zero runtime importers and zero unit tests in WE; only a doc-ref njk/json to repoint at fui:. Removes one duplicated/drifting reference-runtime family per the #1246 ruling (WE holds zero block impl). No consumer breaks.

## Progress

Deleted `we:blocks/data-transfer/` (impl + maps + the co-located unit test). The block stays a valid
WE-standard catalog entry: `we:src/_data/blocks/data-transfer.json` declares
`implementedBy: @frontierui/blocks/data-transfer/DataTransferZoneElement.ts` and the description njk is
doc-only — both kept as doc-refs pointing at fui:. Regenerated `we:src/_data/referenceIndex.json`.

**Premise note:** as with #1310, the body said "zero unit tests in WE" but there was one
(`we:blocks/data-transfer/__tests__/data-transfer.test.ts`), a duplicate of FUI's canonical
`fui:blocks/data-transfer/__tests__/dataTransfer.test.ts` — deleted with the dir, no coverage lost.
The only repo mentions of the family outside the dir are doc-comments in
`we:blocks/renderers/reorderable-list/renderCrossListReorder.ts` (the cross-list-reorder seam), not
imports — zero runtime importers, no consumer breaks (per the #1246 ruling, WE holds zero block impl).
