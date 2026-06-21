---
kind: story
size: 3
parent: "1384"
status: resolved
blockedBy: []
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "we:src/_data/intents/alignment-guides.json"
tags: []
---

# alignment-guides intent spec — mint we:src/_data/intents/alignment-guides.json (peer-relative magnetic alignment: reference elements, rendered guide lines, snap threshold) composing resizable + arrangeable + free-canvas drag

Fork 3b of #1384: a standalone alignment-guides intent for magnetic/Figma-style peer alignment (needs no grid), distinct from grid-snap (a dimension of arrangeable). Composes with resizable, arrangeable, and free-canvas drag. Build deferred from the spatial-manipulation placement ruling.

## Progress

- Minted we:src/_data/intents/alignment-guides.json (+ glossary
  we:src/_data/semantics/alignment-guides.json); auto-renders at /intents/alignment-guides/ via
  we:src/intent-pages.njk. `status: concept`.
- Dimensions: `reference` (peers/container/both default), `edges` (bounds/centers/both default),
  `guides` (shown default/hidden). Snap threshold is a numeric binding property (not an enum).
- Authored the standalone-vs-grid-snap distinction in prose (peer-relative reference frame, needs no
  grid — the survey's load-bearing finding); composition seams to resizable, arrangeable, and free-canvas
  drag named, with the pan-drag recognized via the gesture intent. Cleared the stale `blockedBy: ["1384"]`
  edge (#1384 resolved).
