---
kind: story
size: 3
parent: "1734"
status: resolved
blockedBy: ["1743"]
dateOpened: "2026-06-24"
dateStarted: "2026-06-26"
dateResolved: "2026-06-26"
graduatedTo: 1734
tags: []
---

# region-select lasso + polygon realizations (point-in-polygon members)

FUI slice (locus fui:). Add the lasso and polygon shape members under fui:blocks/region-select/, both realizing the shared point-in-polygon hit-test over a vertex list from #1743's geometry module — they differ only in the gesture that builds the vertex list: lasso = freehand pointer drag (Douglas-Peucker simplified closed path, the Excalidraw precedent), polygon = click-to-add vertices. Each declares its shape value against the #1742 intent. Kept as one slice because they share the exact hit-test helper (splitting gains no independence). Blocked by #1743. Demoable: freehand-lasso and click-polygon select on a canvas demo.

## Progress (batch-2026-06-26-1745-1775)

Both members are thin gesture controllers over the #1743 kernel's `polygonHitTest` (point-in-polygon) —
shared hit-test, differing only in how the vertex list is built:
- `fui:blocks/region-select/LassoPolygonSelect.ts` — `createLassoSelect` (freehand drag → Douglas–Peucker
  `simplifyPath` → closed polygon, hit-tested live) + `createPolygonSelect` (click-to-add vertices, Enter /
  double-click close, Escape cancel). Both inherit modifier vocab + keyboard a11y-parity; SVG path overlay.
- `fui:blocks/region-select/index.ts` — barrel exports added.
- `fui:demos/region-select-lasso-demo.html` — freehand-lasso + click-polygon select with a gesture toggle.
- `fui:src/_data/blocks.json` — `lasso-select` + `polygon-select` entries, `intentDimensions.shape`
  lasso / polygon (#1742).

FUI `check:standards` baseline-steady (34 pre-existing errors in the component-relocation churn, none mine).
