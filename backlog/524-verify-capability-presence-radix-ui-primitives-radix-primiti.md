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

# Verify capability presence — Radix UI Primitives (radix-primitives)

Per-source slice of #495: walk the Radix UI Primitives docs (https://www.radix-ui.com/primitives) and confirm presence for each of the 96 benchmark capabilities, then splice rows into benchmarkCapabilityPresence.json for sourceId radix-primitives — upgrade the notable-inference seed rows in place to provenance verified with the deep doc URL and the vendor sourceName, and insert newly-found present capabilities. Never rewrite the whole file; splice only this source's rows so re-runs diff cleanly. Method and validator were settled by foundation #352. Independent of every other source slice.

## Progress (2026-06-13) — resolved

Walked the Radix UI Primitives docs and spliced **38 verified rows** into `benchmarkCapabilityPresence.json` for `radix-primitives` (all 13 seed rows upgraded in place + 25 new, deep doc URLs). As a headless primitives library, Radix documents both components and interaction patterns by name — verified rows include focus-trap/return, roving-tabindex, type-ahead, dismissal, controlled/uncontrolled, live-region, anchored-positioning. Correctly excluded token/data-display capabilities (those live in Radix Themes, not Primitives). `check:standards` green.
