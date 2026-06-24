---
kind: epic
size: 13
parent: "099"
status: open
dateOpened: "2026-06-24"
tags: []
---

# region-select intent — mint + full shape vocabulary (rect | lasso | polygon | nearest)

Mint a cross-cutting region-select intent carrying a shape dimension (rect | lasso | polygon | nearest), designed in full up front so the modifier/intersect contract is proven against the whole vocabulary rather than retrofitted when a late shape appears. The gesture/geometry layer (band geometry, hit-testing, modifier resolution) is re-homed off the single marquee block into the intent's realization contract; the resolved #1406 marquee-select block becomes the rect realization, with lasso (closed-path point-in-polygon), polygon (vertex point-in-polygon) and nearest (centroid) specified from settled incumbent geometry. Graduated from the #1463 GO ruling (completeness-early beats YAGNI for a standard's vocabulary). Parent #099 (the intent layer).
