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

# Verify capability presence — Lion (lion)

Per-source slice of #495: walk the Lion docs (https://lion-web.netlify.app/) and confirm presence for each of the 96 benchmark capabilities, then splice rows into benchmarkCapabilityPresence.json for sourceId lion — upgrade the notable-inference seed rows in place to provenance verified with the deep doc URL and the vendor sourceName, and insert newly-found present capabilities. Never rewrite the whole file; splice only this source's rows so re-runs diff cleanly. Method and validator were settled by foundation #352. Independent of every other source slice.

## Progress (2026-06-13) — resolved

Walked the Lion docs (lion-web.netlify.app — ING's headless white-label library) and spliced **33 verified rows** into `benchmarkCapabilityPresence.json` for `lion` (no prior seed rows; all new, deep doc URLs + Lion's own names, e.g. Input Stepper, Input Datepicker, Overlay system). Verified rows include the overlay/form/localize fundamentals systems. Correctly excluded design tokens + data-display components — Lion is headless with no token docs. `check:standards` green.
