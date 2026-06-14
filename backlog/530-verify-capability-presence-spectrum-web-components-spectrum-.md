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

# Verify capability presence — Spectrum Web Components (spectrum-web-components)

Per-source slice of #495: walk the Spectrum Web Components docs (https://opensource.adobe.com/spectrum-web-components/) and confirm presence for each of the 96 benchmark capabilities, then splice rows into benchmarkCapabilityPresence.json for sourceId spectrum-web-components — upgrade the notable-inference seed rows in place to provenance verified with the deep doc URL and the vendor sourceName, and insert newly-found present capabilities. Never rewrite the whole file; splice only this source's rows so re-runs diff cleanly. Method and validator were settled by foundation #352. Independent of every other source slice.

## Progress (2026-06-13) — resolved

Walked the Spectrum Web Components docs (opensource.adobe.com/spectrum-web-components) and spliced **51 verified rows** into `benchmarkCapabilityPresence.json` for `spectrum-web-components` (no prior seed rows; all new, deep doc URLs + SWC's own names, e.g. Picker, Tray, Action Group, Illustrated Message). Adobe's web-component impl of Spectrum. `check:standards` green.
