---
kind: epic
parent: "099"
status: resolved
dateOpened: "2026-06-24"
dateResolved: "2026-06-27"
graduatedTo: "intent:region-select"
relatedReport: reports/2026-06-24-1734-split-analysis.md
tags: []
---

# region-select intent — mint + full shape vocabulary (rect | lasso | polygon | nearest)

Mint a cross-cutting region-select intent carrying a shape dimension (rect | lasso | polygon | nearest), designed in full up front so the modifier/intersect contract is proven against the whole vocabulary rather than retrofitted when a late shape appears. The gesture/geometry layer is re-homed off the single marquee block into the intent's realization contract; #1406 marquee-select becomes the rect realization, with lasso (closed-path point-in-polygon), polygon (vertex point-in-polygon) and nearest (centroid) specified from settled incumbent geometry. Graduated from the #1463 GO ruling (completeness-early beats YAGNI for a standard's vocabulary). Sliced A–D (see relatedReport). Parent #099 (the intent layer).
