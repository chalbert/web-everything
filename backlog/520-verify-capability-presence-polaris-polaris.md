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

# Verify capability presence — Polaris (polaris)

Per-source slice of #495: walk the Polaris docs (https://polaris.shopify.com/) and confirm presence for each of the 96 benchmark capabilities, then splice rows into benchmarkCapabilityPresence.json for sourceId polaris — upgrade the notable-inference seed rows in place to provenance verified with the deep doc URL and the vendor sourceName, and insert newly-found present capabilities. Never rewrite the whole file; splice only this source's rows so re-runs diff cleanly. Method and validator were settled by foundation #352. Independent of every other source slice.

## Progress (2026-06-13) — resolved

Walked the Shopify Polaris docs (polaris-react.shopify.com — components, tokens, accessibility) and spliced **58 verified rows** into `benchmarkCapabilityPresence.json` for `polaris` (1 seed row upgraded in place + 57 new, deep doc URLs + Polaris's own names; deprecated-but-documented pages like Modal/Sheet/Top bar counted). Conservatively omitted capabilities with no real page (dark-mode, RTL, tree-view, command-palette, etc.). `check:standards` green.
