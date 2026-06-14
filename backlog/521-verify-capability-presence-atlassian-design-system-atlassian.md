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

# Verify capability presence — Atlassian Design System (atlassian)

Per-source slice of #495: walk the Atlassian Design System docs (https://atlassian.design/) and confirm presence for each of the 96 benchmark capabilities, then splice rows into benchmarkCapabilityPresence.json for sourceId atlassian — upgrade the notable-inference seed rows in place to provenance verified with the deep doc URL and the vendor sourceName, and insert newly-found present capabilities. Never rewrite the whole file; splice only this source's rows so re-runs diff cleanly. Method and validator were settled by foundation #352. Independent of every other source slice.

## Progress (2026-06-13) — resolved

Walked the Atlassian Design System docs (atlassian.design — components + foundations) and spliced **57 verified rows** into `benchmarkCapabilityPresence.json` for `atlassian` (no prior seed rows; all 57 new, deep doc URLs + Atlassian's own names, e.g. Lozenge, Flag, Pragmatic drag-and-drop). Conservatively omitted capabilities with no real page. `check:standards` green.
