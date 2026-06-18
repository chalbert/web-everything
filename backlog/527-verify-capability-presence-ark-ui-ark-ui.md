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

# Verify capability presence — Ark UI (ark-ui)

Per-source slice of #495: walk the Ark UI docs (https://ark-ui.com/) and confirm presence for each of the 96 benchmark capabilities, then splice rows into we:benchmarkCapabilityPresence.json for sourceId ark-ui — upgrade the notable-inference seed rows in place to provenance verified with the deep doc URL and the vendor sourceName, and insert newly-found present capabilities. Never rewrite the whole file; splice only this source's rows so re-runs diff cleanly. Method and validator were settled by foundation #352. Independent of every other source slice.

## Progress (2026-06-13) — resolved

Walked the Ark UI docs (ark-ui.com — headless library on Zag.js) and spliced **49 verified rows** into `we:benchmarkCapabilityPresence.json` for `ark-ui` (4 seed rows upgraded in place + 45 new, deep doc URLs). Strong primitive coverage incl. pickers, pin-input, rating, splitter, carousel, clipboard. Excluded a dubious button→Toggle mapping and design-token capabilities (Ark is unstyled). `check:standards` green.
