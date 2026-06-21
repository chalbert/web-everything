---
kind: story
size: 5
parent: "1384"
status: open
blockedBy: ["1384"]
dateOpened: "2026-06-21"
tags: []
---

# arrangeable intent spec — mint we:src/_data/intents/arrangeable.json (2-D grid placement: {x,y,w,h}, collision/compaction, resize) composing reorder's Pointer/keyboard/live-region/moveBefore substrate; grid-snap is a dimension

Fork 2 + Fork 3a of #1384: a new arrangeable intent owning the 2-D placement model (draggable dashboard) that REUSES reorderable-list's shipped substrate rather than overloading reorder's 1-D order contract; grid-snap falls out as a dimension (no separate entity). APG Grid a11y. Build deferred from the spatial-manipulation placement ruling.
