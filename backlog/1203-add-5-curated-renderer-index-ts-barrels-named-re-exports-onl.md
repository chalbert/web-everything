---
type: idea
workItem: story
size: 3
parent: "904"
locus: frontierui
status: open
dateOpened: "2026-06-20"
tags: []
---

# Add 5 curated renderer index barrels (named re-exports only) — #1164 graduation slice 1

Per the #1164 ruling (B): add a curated per-dir barrel (one per renderer, e.g. `fui:blocks/renderers/data-table/index.ts`) for collection-operations, data-grid, data-table, pagination, reorderable-list. NAMED re-exports only (never export *) — this is the anti-drift rule: a named export {X} from './leaf' is a TS error if the leaf drops X (compiler locks barrel→impl). Each barrel re-exports exactly the block's declared public surface. Foundational slice; locus frontierui.
