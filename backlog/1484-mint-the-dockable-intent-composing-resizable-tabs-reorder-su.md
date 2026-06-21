---
kind: story
size: 3
status: open
blockedBy: ["1437"]
dateOpened: "2026-06-21"
tags: []
---

# Mint the dockable intent (composing resizable + tabs + reorder substrate)

Realizing build of #1437 Fork 1a: author the dockable intent as a WE standard artifact (we:src/_data/intents/dockable.json) — the recursive-container model (node = row|column|stack, space fully partitioned, no gaps/overlaps) + drag-to-dock re-tiling semantics + the composed a11y contract (APG Window Splitter on splits, APG Tabs on stacks). Composes the shipped resizable splitter, the tabs block, and reorder's grab/move/drop + live-region + moveBefore substrate ratified by #1384. Adds no new gesture. Dimensions: orientation/sizing + the popout dimension (Fork 3a, default none minimal-core).
