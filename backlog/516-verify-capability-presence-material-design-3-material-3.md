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

# Verify capability presence — Material Design 3 (material-3)

Per-source slice of #495: walk the Material Design 3 docs (https://m3.material.io/) and confirm presence for each of the 96 benchmark capabilities, then splice rows into we:benchmarkCapabilityPresence.json for sourceId material-3 — upgrade the notable-inference seed rows in place to provenance verified with the deep doc URL and the vendor sourceName, and insert newly-found present capabilities. Never rewrite the whole file; splice only this source's rows so re-runs diff cleanly. Method and validator were settled by foundation #352. Independent of every other source slice.

## Progress (2026-06-13) — resolved

Walked the Material Design 3 docs (m3.material.io) and spliced **45 verified rows** into `we:benchmarkCapabilityPresence.json` for `material-3` — 15 notable-inference seed rows upgraded in place to `verified` with deep doc URLs + the vendor's own names, 30 newly-found present capabilities added. The 4 seed rows not confirmable against a real M3 page were left as the `notable-inference` floor (never proven-absent). Conservatively omitted capabilities with no citable M3 page (combobox, tree-view, data-table, command-palette, file-upload, rating, rich-text-editor, skeleton, empty-state, focus-trap, virtualization, drag-and-drop, etc.). `check:standards` green.
