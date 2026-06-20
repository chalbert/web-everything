---
type: idea
workItem: story
size: 2
parent: "904"
status: open
blockedBy: ["1203"]
dateOpened: "2026-06-20"
tags: []
---

# Re-point 5 renderer implementedBy at new barrels + extend 8e barrelBlocks filter + gen:cem

Per the #1164 ruling (B), slice 2: re-point each renderer block's implementedBy in its `we:src/_data/blocks/` spec from the dir-style ref to the new per-dir barrel (one per renderer, e.g. `fui:blocks/renderers/data-table/index.ts`), extend the 8e barrelBlocks filter in we:scripts/check-standards.mjs:824 so the 5 renderers ride the uniform getExportsOfModule TS-program path, and regenerate the CEM (gen:cem). Closes the contract→barrel drift direction. blockedBy #1203 (barrels must exist first).
