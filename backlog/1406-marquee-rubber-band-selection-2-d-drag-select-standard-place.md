---
kind: decision
size: 3
parent: "099"
status: open
dateOpened: "2026-06-21"
tags: [decision, book-candidate, selection, marquee, spatial, gap, interaction]
---

# Marquee / rubber-band selection — 2-D drag-select standard: placement

Verb-axis straggler (completeness sweep of [#1390](/backlog/1390-interaction-paradigm-inventory-verb-axis-gap-lens-find-missi/)):
drag a rectangle over a 2-D surface (canvas, file grid, board, diagram) to select everything it
intersects, with additive (shift) / toggle (ctrl) modifiers and keyboard equivalent. The `selection`
intent owns single/multi *choice* over a collection, **not spatial drag-select**.

**Decision:** a dimension of `selection` (`scope: spatial`) vs its own intent vs a behavior composing
`selection` + pointer drag. Overlaps the spatial-manipulation cluster
([#1384](/backlog/1384-spatial-manipulation-arrangeable-surfaces-resizable-splitter/)) and gestures
([#1396](/backlog/1396-pointer-gestures-swipe-long-press-pinch-pull-to-refresh-plac/)). Ref:
[we:src/_data/intents/selection.json](../src/_data/intents/selection.json). **Needs `/prepare`.** Unsure
⇒ decision; costs nothing.
