---
type: issue
workItem: story
size: 5
parent: "904"
status: resolved
locus: frontierui
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: frontierui/blocks/renderers/reorderable-list/reorderState.ts
tags: []
---

# Build reorderable-list FUI block impl

Build reorderable-list in `fui:blocks/renderers/reorderable-list/` (contract: we:src/_data/blocks/reorderable-list.json). User-mutable item order by pointer drag and keyboard, live-region announcement, pluggable commit strategy; relocate items with atomic Element.moveBefore() so an item keeps focus/animation/connection state across a move. Manual order — not Collection Operations' computed sort. locus frontierui. Slice of #904.

## Built (batch-2026-06-18)

Shipped in **frontierui** at `blocks/renderers/reorderable-list/` (renderers family — gate-excluded,
no blocks.json entry):

- **`reorderState.ts`** — the pure DOM-free reducer driving BOTH paths identically (keyboard parity
  mandatory): `initialState`, `reduceReorder` (grab/move/moveBy/drop/cancel; grab snapshots a
  baseline, cancel restores it), `announce` (polite live-region wording, replaces deprecated
  aria-grabbed), `reconcileOrder` (atomic `Element.moveBefore()` relocation with `insertBefore`
  fallback — preserves focus/animation/connection, `atomicMove`), `orderChanged`.
- **`renderReorderableList.ts`** — APG structure (`role=list`, grab-handle buttons, roving tabindex,
  polite live region) + `auditReorderableList` (DOM order matches state, single roving entry, live
  region present, no deprecated drag aria) + `labelsOf`.
- Exported from `blocks/renderers/index.ts`. Manual order — the inverse of Collection Operations'
  computed sort (`manualVsComputedOrder`).

Gate: `check:standards` green (0 errors), 10 vitest specs pass, `tsc` clean. (The 6 contract traits
are the design surface, not built here — renderers family carries no traits.json drift.)
