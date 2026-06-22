---
kind: story
size: 3
parent: "1485"
locus: frontierui
status: resolved
blockedBy: ["1511"]
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
tags: []
---

# FUI dockable drag-to-dock — edge/center hit-testing + topology mutation

Slice of #1485 (locus:frontierui, live-interactive): drag-to-dock edge/center zone hit-testing that splits a leaf into a new row/column/stack (the tree-topology mutation = dockable's irreducible vocabulary), plus APG Tabs on every stack. Composes #1384 Pointer-Events substrate + moveBefore relocation + #1495 gesture pan. Verified live (no meaningful unit proof of a pointer-driven re-tile). blockedBy #1511 (container render).

## Progress

- `fui:blocks/dockable/dockTopology.ts` — the irreducible vocabulary as two PURE, browser-free functions (unit-proven): `hitTestDockZone(rect,x,y)` maps a pointer over a leaf box onto a zone (4 edge bands → split, center → tab-merge; configurable edge fraction, deterministic corner tie-breaks); `dockPanel(layout, sourcePanelId, targetId, zone)` returns a NEW `DockLayout` with the tree re-partitioned — an edge splits the target leaf into a fresh row/column, center merges the panel into the target stack. Lifts the source cleanly: prunes an emptied stack, collapses a single-child split (slot size inherited) so the partition stays gap-free. No-ops on unknown panel / stale target.
- `fui:blocks/dockable/DockDragBehavior.ts` — the live Pointer-Events glue (the part with no meaningful unit proof): tab triggers become draggable, a drop-zone indicator overlay snaps to the resolved zone, and on release it `serializeDockable`s the LIVE tree (#1513 — captures current resize weights) → `dockPanel` → `renderDockable`, re-wiring the resize + drag behaviors. So a dock preserves live proportions. APG Tabs a11y stays owned by the `we-tabs` kernel each stack hosts.
- Unit tests `dockTopology.test.ts` (hit-testing zones + edge fraction; split/merge mutation; prune+collapse; immutability; no-op cases). 29/29 dockable unit tests green.
- **Live-verified** via the new `fui:demos/dockable-dock-demo.html` (Playwright pointer drag against :3001): dragging the `Search` tab onto the editor leaf's right edge split it (2→3 splits, 3→4 panes), the drop indicator rendered during the drag, the panel relocated, **zero console errors**.
