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

# Verify capability presence — Base UI (base-ui)

Per-source slice of #495: walk the Base UI docs (https://base-ui.com/) and confirm presence for each of the 96 benchmark capabilities, then splice rows into we:benchmarkCapabilityPresence.json for sourceId base-ui — upgrade the notable-inference seed rows in place to provenance verified with the deep doc URL and the vendor sourceName, and insert newly-found present capabilities. Never rewrite the whole file; splice only this source's rows so re-runs diff cleanly. Method and validator were settled by foundation #352. Independent of every other source slice.

## Progress (2026-06-13) — resolved

Walked the Base UI docs (base-ui.com — the headless library by the MUI/Radix/Floating UI teams) and spliced **39 verified rows** into `we:benchmarkCapabilityPresence.json` for `base-ui` (1 seed row upgraded in place + 38 new, deep doc URLs). Verified rows include components plus documented patterns (Positioner anchored-positioning, focus management, Direction Provider RTL). Correctly excluded design-token capabilities — Base UI is unstyled/headless. `check:standards` green.
