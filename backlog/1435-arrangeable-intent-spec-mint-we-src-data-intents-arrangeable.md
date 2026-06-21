---
kind: story
size: 5
parent: "1384"
status: resolved
blockedBy: []
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "we:src/_data/intents/arrangeable.json"
tags: []
---

# arrangeable intent spec — mint we:src/_data/intents/arrangeable.json (2-D grid placement: {x,y,w,h}, collision/compaction, resize) composing reorder's Pointer/keyboard/live-region/moveBefore substrate; grid-snap is a dimension

Fork 2 + Fork 3a of #1384: a new arrangeable intent owning the 2-D placement model (draggable dashboard) that REUSES reorderable-list's shipped substrate rather than overloading reorder's 1-D order contract; grid-snap falls out as a dimension (no separate entity). APG Grid a11y. Build deferred from the spatial-manipulation placement ruling.

## Progress

- Minted we:src/_data/intents/arrangeable.json (+ glossary we:src/_data/semantics/arrangeable.json);
  auto-renders at /intents/arrangeable/ via we:src/intent-pages.njk. `status: concept`.
- Dimensions: `compaction` (vertical default/horizontal/none/allow-overlap), `snap` (grid default/free —
  grid-snap IS a dimension here, not a separate entity), `resize` (enabled default/disabled). {x,y,w,h}
  state is the flat-grid model.
- Authored the REUSE-not-overload story in prose: composes the shipped reorderable-list substrate
  (Pointer drag, roving-tabindex keyboard, live-region, atomic moveBefore) rather than bending reorder's
  1-D order contract; APG Grid a11y as a FIXED invariant. Named the snap seam (grid-snap here vs the
  standalone alignment-guides intent vs scroll-snap). Cleared the stale `blockedBy: ["1384"]` edge.
