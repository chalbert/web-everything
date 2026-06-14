---
type: issue
workItem: task
parent: "495"
status: open
dateOpened: "2026-06-14"
tags: []
---

# Verify capability presence — React Aria (react-aria)

Per-source slice of #495: walk the React Aria docs (https://react-spectrum.adobe.com/react-aria/) and confirm presence for each of the 96 benchmark capabilities, then splice rows into benchmarkCapabilityPresence.json for sourceId react-aria — upgrade the notable-inference seed rows in place to provenance verified with the deep doc URL and the vendor sourceName, and insert newly-found present capabilities. Never rewrite the whole file; splice only this source's rows so re-runs diff cleanly. Method and validator were settled by foundation #352. Independent of every other source slice.
