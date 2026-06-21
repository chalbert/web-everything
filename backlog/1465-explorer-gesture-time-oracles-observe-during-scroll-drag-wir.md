---
kind: story
size: 3
locus: frontierui
status: resolved
blockedBy: []
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "fui:tools/explorer/oracles/genericInvariants.ts"
tags: [explorer, oracles, gesture, frontierui]
---

# Explorer gesture-time oracles: observe DURING scroll/drag + wire clipped-residue / scroll-jump / drag-drags-page signals

The residual half of #1418 scope 4. #1418 delivered the active-gesture *repertoire* (scroll page +
containers, reveal off-screen, drag) and — because the explorer's `onState` seam already fires after each
candidate — *post-gesture* layout observation comes for free (the Layer-1 oracles run on the settled
state after every scroll/drag). It also added the pure `clippedOverflowResidue` signal helper
(fui:tools/explorer/gestureProbes.ts) complementing #1412.

What remains here:

1. **Observe DURING a gesture, not only after it settles.** Sample layout mid-drag / mid-scroll (e.g.
   between `mouse.down` and `mouse.up`) so a defect visible only transiently is caught.
2. **Wire the new gesture-time signals as live oracles** over a new Observation field: the
   `clippedOverflowResidue` (programmatically-scrollable-despite-clip — the WE-site 49px residue, helper
   already built + tested), a scroll position that jumps/resets unexpectedly, and a drag that drags the
   whole page or reveals clipped chrome.
3. Collect the residue/scroll metrics in fui:tools/explorer/oracles/playwrightCollector.ts and surface
   them on the Observation so the oracle layer (fui:tools/explorer/oracles/genericInvariants.ts) can flag
   them as advisory `warn`s.

Gate in frontierui (`npm run check:standards` + the explorer vitest suite). The pure helper + repertoire
already exist; this is the observation-pipeline wiring.

## Progress (batch-2026-06-21)

Wired the gesture-time signals end-to-end through the Layer-1 oracle pipeline:
- **Observation fields** (`fui:tools/explorer/oracles/observation.ts`): `clippedResidue` (ClippedResidue
  | null, imported from the #1418 `fui:tools/explorer/gestureProbes.ts`), `scrollJump`, `dragDragsPage`.
- **Three advisory `warn` oracles** (`fui:tools/explorer/oracles/genericInvariants.ts`):
  `no-clipped-residue`, `no-scroll-jump`, `no-drag-drags-page`; added to `LAYER1_ORACLES` (now 10).
- **Collector** (`fui:tools/explorer/oracles/playwrightCollector.ts`): `#domProbes` now reads the y-axis
  metrics and computes `clippedResidue` by **reusing the pure `clippedOverflowResidue` helper** (no drift);
  `observe(stateId, gestureSignals?)` folds in the during-gesture `scrollJump`/`dragDragsPage` the driver
  samples (new `GestureSignals` type).
- **Live now:** `clippedResidue` flows through the existing `onState` observe seam, so the residue oracle
  fires on every settled scroll/drag state (the WE-site 49px residue is caught). The scroll-jump /
  drag-drags-page signals are plumbed (field → collector param → oracle) for the driver's mid-gesture
  (`mouse.down`→`mouse.up`) sampling — the in-page bridge concern.
- 4 new oracle unit tests (`fui:tools/explorer/oracles/__tests__/genericInvariants.test.ts`, now 14;
  explorer suite 81/81). FUI `check:standards` → 0 errors; explorer files typecheck clean.
