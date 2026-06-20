---
kind: task
parent: "495"
status: resolved
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: none
tags: []
---

# Verify capability presence — Carbon Design System (carbon)

Per-source slice of #495: walk the Carbon Design System docs (https://carbondesignsystem.com/) and confirm presence for each of the 96 benchmark capabilities, then splice rows into we:benchmarkCapabilityPresence.json for sourceId carbon — upgrade the notable-inference seed rows in place to provenance verified with the deep doc URL and the vendor sourceName, and insert newly-found present capabilities. Never rewrite the whole file; splice only this source's rows so re-runs diff cleanly. Method and validator were settled by foundation #352. Independent of every other source slice.

## Progress (2026-06-13) — resolved

Walked the Carbon Design System docs (carbondesignsystem.com) and spliced **56 verified rows** into `we:benchmarkCapabilityPresence.json` for `carbon` — 17 notable-inference seed rows upgraded in place to `verified` (deep doc URLs + Carbon's own component names), 39 newly-found present capabilities added (components, patterns, elements/tokens, accessibility guidelines). Conservatively omitted capabilities with no citable Carbon page. `check:standards` green.
