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

# Verify capability presence — Lightning Design System (lightning)

Per-source slice of #495: walk the Lightning Design System docs (https://www.lightningdesignsystem.com/) and confirm presence for each of the 96 benchmark capabilities, then splice rows into we:benchmarkCapabilityPresence.json for sourceId lightning — upgrade the notable-inference seed rows in place to provenance verified with the deep doc URL and the vendor sourceName, and insert newly-found present capabilities. Never rewrite the whole file; splice only this source's rows so re-runs diff cleanly. Method and validator were settled by foundation #352. Independent of every other source slice.

## Progress (2026-06-13) — resolved

Walked the Salesforce Lightning Design System docs and spliced **63 verified rows** into `we:benchmarkCapabilityPresence.json` for `lightning` (no prior seed rows; all new, deep doc URLs + SLDS's own names, e.g. Pills, Path, Dueling Picklist). Verified against the v1 mirror (v1.lightningdesignsystem.com) — the current site is JS-rendered/opaque to fetch but the v1 mirror serves the same Blueprint docs at stable URLs. Conservatively omitted capabilities with no real page. `check:standards` green.
