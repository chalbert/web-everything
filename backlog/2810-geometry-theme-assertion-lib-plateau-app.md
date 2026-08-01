---
bornAs: xmllmw4
kind: story
size: 5
parent: "2804"
status: open
blockedBy: ["2809"]
scope:
  - plateau-app:tests/visual/geometry-theme.ts
dateOpened: "2026-08-01"
tags: [plateau-loop, conveyor, ui-fidelity, plateau-app, render-slice, human-verify, slice-uifg]
---

# Geometry + theme assertion lib (plateau-app)

Assert real layout (`plateau-app:tests/visual/geometry-theme.ts`): computed `grid-template-columns` yields N
columns each above a min width, per-cell bounding boxes non-overlapping and non-zero; and theme cascade by
computed-value equality against host tokens. Defeats the collapsed-grid and non-cascading-theme evasions.

## Conveyor guardrail — self-proving, human-verify
**Do NOT auto-resolve on tests-green alone.** Prove against the known-bad board:

- On the CURRENT `/console-board`, the geometry assertion **must FAIL** the multi-lane check (`laneCols<2` — a
  1-column / 2px-collapsed grid must not pass), and the theme assertion must FAIL where the host top bar does
  not cascade to dark. If they pass on today's board, they are wrong.
- `render-slice`: resolve gates on the rendered red→green proof, human-reviewed — not a green unit suite.
