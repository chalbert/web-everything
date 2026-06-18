---
type: issue
workItem: story
size: 3
parent: "904"
status: open
locus: frontierui
dateOpened: "2026-06-18"
tags: []
---

# Build collection-operations FUI block impl

Build the headless collection-operations coordinator in `fui:blocks/renderers/collection-operations/` (contract: we:src/_data/blocks/collection-operations.json). Reuse data-table applyPipeline to run filter/sort/group across the whole set, then window the page slice; ship CollectionOperationsBehavior + optional headless `<collection-operations>` routing data-table-change/pagination-change and emitting collection-operations-change. Composed deps (`fui:blocks/renderers/data-table/`, `fui:blocks/renderers/pagination/`) exist. locus frontierui. Slice of #904 (#452 resolved).
