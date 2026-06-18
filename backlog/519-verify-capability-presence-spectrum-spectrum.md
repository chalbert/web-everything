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

# Verify capability presence — Spectrum (spectrum)

Per-source slice of #495: walk the Spectrum docs (https://spectrum.adobe.com/) and confirm presence for each of the 96 benchmark capabilities, then splice rows into we:benchmarkCapabilityPresence.json for sourceId spectrum — upgrade the notable-inference seed rows in place to provenance verified with the deep doc URL and the vendor sourceName, and insert newly-found present capabilities. Never rewrite the whole file; splice only this source's rows so re-runs diff cleanly. Method and validator were settled by foundation #352. Independent of every other source slice.

## Progress (2026-06-13) — resolved

Walked the Adobe Spectrum docs (spectrum.adobe.com — components, design-tokens, foundations) and spliced **52 verified rows** into `we:benchmarkCapabilityPresence.json` for `spectrum` (3 seed rows upgraded in place + 49 new, deep doc URLs + Spectrum's own names, e.g. Picker, Tray, Action group). Conservatively omitted capabilities with no dedicated Spectrum page. `check:standards` green.
