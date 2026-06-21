---
kind: story
size: 5
status: resolved
blockedBy: []
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "we:src/_data/blocks/data-grid.json"
tags: []
---

# Treegrid: add hierarchy projection to data-grid contract (Right/Left arbitration + role=treegrid + conformance vector + file-explorer demo)

Realizing build for the #1411 ruling (Fork 1a): treegrid is a hierarchy projection on data-grid, not a new block. Add to we:src/_data/blocks/data-grid.json the composed hierarchy intent, role=treegrid, and the movement-engine Right/Left arbitration rule (collapsed parent row + Right = expand / Left = collapse; otherwise cell-movement fallback). Rows = the hierarchy intent's flatten-to-visible projection carrying aria-level/aria-expanded. Add a conformance vector for the arbitration rule + a file-explorer treegrid demo. File real artifacts via /new-standard. No new block, no new engine.

## Progress (batch-2026-06-21)

- **Contract** `we:src/_data/blocks/data-grid.json` — `composesIntents += hierarchy`; added the
  `apgTreeGrid` webStandard (role=treegrid, hierarchy projection), two designDecisions
  (`treegridIsAProjectionNotABlock`, `rightLeftArbitration` — the Right/Left rule: collapsed parent + Right
  = expand / expanded parent + Left = collapse / else cell-movement fallback), and a `withHierarchyProjection`
  trait. Rows = the Hierarchy intent's flatten-to-visible projection carrying aria-level/aria-expanded. No
  new block, no new engine.
- **Conformance vector** `we:conformance-vectors/treegrid-arbitration.vectors.ts` (registered in
  `we:conformance-vectors/index.ts` export + `conformanceSuites`) — 4 vectors covering the arbitration:
  Right-expands-collapsed-parent, Right-on-expanded-falls-back-to-cell-move, Left-collapses-expanded-parent,
  Left-leaf-falls-back-to-cell-move; observed via aria + active-cell only. Passes `assertConformanceSuite`.
- **Demo** `we:demos/treegrid-file-explorer-demo.html` (+ registry
  `we:src/_data/demos/treegrid-file-explorer-demo.json`) — a `role=treegrid` file explorer with the
  flatten-to-visible projection + the Right/Left arbitration inline. Verified live on :3000: Right on a
  collapsed folder expands it (4→6 rows, aria-expanded flips).
- `check:standards` → 0 errors; conformance-vectors schema test 7/7.
