---
kind: story
size: 5
status: open
blockedBy: []
dateOpened: "2026-06-21"
tags: []
---

# Treegrid: add hierarchy projection to data-grid contract (Right/Left arbitration + role=treegrid + conformance vector + file-explorer demo)

Realizing build for the #1411 ruling (Fork 1a): treegrid is a hierarchy projection on data-grid, not a new block. Add to we:src/_data/blocks/data-grid.json the composed hierarchy intent, role=treegrid, and the movement-engine Right/Left arbitration rule (collapsed parent row + Right = expand / Left = collapse; otherwise cell-movement fallback). Rows = the hierarchy intent's flatten-to-visible projection carrying aria-level/aria-expanded. Add a conformance vector for the arbitration rule + a file-explorer treegrid demo. File real artifacts via /new-standard. No new block, no new engine.
