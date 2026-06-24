---
kind: task
parent: "1734"
status: open
blockedBy: ["1743"]
dateOpened: "2026-06-24"
tags: []
---

# region-select nearest realization (centroid member)

FUI slice (locus fui:). Add the nearest shape member under fui:blocks/region-select/ — a centroid/nearest-point selection over the shared geometry module from #1743 (nearest = centroid distance per the #1463 GO ruling), declaring shape: nearest against the #1742 intent. Independent of the lasso/polygon slice #1744 (both consume only #1743's module). Blocked by #1743. Demoable: nearest/centroid select on the region-select demo.
