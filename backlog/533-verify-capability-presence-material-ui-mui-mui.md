---
type: issue
workItem: task
parent: "495"
status: resolved
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: none
tags: []
---

# Verify capability presence — Material UI (MUI) (mui)

Per-source slice of #495: walk the Material UI (MUI) docs (https://mui.com/material-ui/) and confirm presence for each of the 96 benchmark capabilities, then splice rows into benchmarkCapabilityPresence.json for sourceId mui — upgrade the notable-inference seed rows in place to provenance verified with the deep doc URL and the vendor sourceName, and insert newly-found present capabilities. Never rewrite the whole file; splice only this source's rows so re-runs diff cleanly. Method and validator were settled by foundation #352. Independent of every other source slice.

## Progress (2026-06-13) — resolved

Walked the Material UI docs (mui.com/material-ui + MUI X data-grid/date-pickers/tree-view + theming/a11y) and spliced **75 verified rows** into `benchmarkCapabilityPresence.json` for `mui` (1 seed row upgraded in place + 74 new, deep doc URLs + MUI's own names). Broadest coverage in the batch — full token system, MUI X advanced grids/pickers, documented patterns (focus-trap, virtualization, click-away dismissal). `check:standards` green.
