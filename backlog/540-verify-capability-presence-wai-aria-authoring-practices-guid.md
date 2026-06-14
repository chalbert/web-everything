---
type: issue
workItem: task
parent: "495"
status: open
dateOpened: "2026-06-14"
tags: []
---

# Verify capability presence — WAI-ARIA Authoring Practices Guide (wai-aria-apg)

Per-source slice of #495: walk the WAI-ARIA Authoring Practices Guide docs (https://www.w3.org/WAI/ARIA/apg/) and confirm presence for each of the 96 benchmark capabilities, then splice rows into benchmarkCapabilityPresence.json for sourceId wai-aria-apg — upgrade the notable-inference seed rows in place to provenance verified with the deep doc URL and the vendor sourceName, and insert newly-found present capabilities. Never rewrite the whole file; splice only this source's rows so re-runs diff cleanly. Method and validator were settled by foundation #352. Independent of every other source slice.
