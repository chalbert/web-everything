---
type: issue
workItem: story
size: 5
parent: "904"
status: open
locus: frontierui
dateOpened: "2026-06-18"
tags: []
---

# Build reorderable-list FUI block impl

Build reorderable-list in `fui:blocks/renderers/reorderable-list/` (contract: we:src/_data/blocks/reorderable-list.json). User-mutable item order by pointer drag and keyboard, live-region announcement, pluggable commit strategy; relocate items with atomic Element.moveBefore() so an item keeps focus/animation/connection state across a move. Manual order — not Collection Operations' computed sort. locus frontierui. Slice of #904.
