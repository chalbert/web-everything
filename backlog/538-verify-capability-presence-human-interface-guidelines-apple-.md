---
type: issue
workItem: task
parent: "495"
status: resolved
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
tags: []
---

# Verify capability presence — Human Interface Guidelines (apple-hig)

Per-source slice of #495: walk the Human Interface Guidelines docs (https://developer.apple.com/design/human-interface-guidelines/) and confirm presence for each of the 96 benchmark capabilities, then splice rows into we:benchmarkCapabilityPresence.json for sourceId apple-hig — upgrade the notable-inference seed rows in place to provenance verified with the deep doc URL and the vendor sourceName, and insert newly-found present capabilities. Never rewrite the whole file; splice only this source's rows so re-runs diff cleanly. Method and validator were settled by foundation #352. Independent of every other source slice.
