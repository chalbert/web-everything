---
kind: story
size: 5
parent: "xnu179a"
status: open
dateOpened: "2026-08-01"
blockedBy: ["xscdebo"]
tags: [plateau-loop, conveyor, ui-fidelity, plateau-app, slice-uifg]
---

# Geometry + theme assertion lib (plateau-app)

Assert real layout: computed grid-template-columns yields N columns each above a min width, per-cell bounding boxes non-overlapping and non-zero; and theme cascade by computed-value equality against host tokens. Defeats the collapsed-grid and non-cascading-theme evasions.
