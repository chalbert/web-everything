---
kind: story
size: 3
parent: "1734"
status: open
blockedBy: ["1743"]
dateOpened: "2026-06-24"
tags: []
---

# region-select lasso + polygon realizations (point-in-polygon members)

FUI slice (locus fui:). Add the lasso and polygon shape members under fui:blocks/region-select/, both realizing the shared point-in-polygon hit-test over a vertex list from #1743's geometry module — they differ only in the gesture that builds the vertex list: lasso = freehand pointer drag (Douglas-Peucker simplified closed path, the Excalidraw precedent), polygon = click-to-add vertices. Each declares its shape value against the #1742 intent. Kept as one slice because they share the exact hit-test helper (splitting gains no independence). Blocked by #1743. Demoable: freehand-lasso and click-polygon select on a canvas demo.
