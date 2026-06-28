---
kind: task
parent: "1734"
status: resolved
blockedBy: ["1743"]
dateOpened: "2026-06-24"
dateStarted: "2026-06-26"
dateResolved: "2026-06-26"
graduatedTo: 1734
tags: []
---

# region-select nearest realization (centroid member)

FUI slice (locus fui:). Add the nearest shape member under fui:blocks/region-select/ — a centroid/nearest-point selection over the shared geometry module from #1743 (nearest = centroid distance per the #1463 GO ruling), declaring shape: nearest against the #1742 intent. Independent of the lasso/polygon slice #1744 (both consume only #1743's module). Blocked by #1743. Demoable: nearest/centroid select on the region-select demo.

## Progress (batch-2026-06-26-1745-1775)

The geometry kernel (#1743) already ships `nearestHit` + the `regionHitIds` `nearest` branch, so this slice
is the thin member + demo + intent declaration:
- `fui:blocks/region-select/NearestSelect.ts` — `createNearestSelect` click-to-pick controller over the
  shared kernel (`regionHitIds({shape:'nearest'})` + `resolveSelection` + `modifierFromEvent`), inheriting
  the modifier vocab + keyboard a11y-parity (`extendByKeyboard`) from the `rect` member.
- `fui:blocks/region-select/index.ts` — region-select family barrel (kernel + nearest member).
- `fui:demos/region-select-nearest-demo.html` — nearest/centroid select on a 24-tile surface.
- `fui:src/_data/blocks.json` — `nearest-select` block entry, `intentDimensions.shape: nearest` (#1742).
