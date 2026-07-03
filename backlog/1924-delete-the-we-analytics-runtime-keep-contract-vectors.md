---
kind: story
size: 2
parent: "1294"
status: resolved
blockedBy: ["1921"]
dateOpened: "2026-06-28"
dateStarted: "2026-07-03"
dateResolved: "2026-07-03"
tags: []
---

# Delete the WE analytics runtime (keep contract + vectors)

Slice 4 of the analytics relocation cascade (#1294). Delete the executable analytics runtime from WE (we:analytics/provider.ts) now that fui:analytics hosts it and conformance is proven from the binding+vectors. WE retains we:analytics/contract.ts + the vector corpus — the #1282 zero-executable end-state for analytics. Mirrors webpolicy W4 (#1802).

## Resolution

Deleted `we:analytics/provider.ts` (the `NoopTracker` native-first no-op runtime + its contract re-export). The runtime now lives only in FUI (`fui:plugs/webanalytics/provider.ts`, relocated #1915), and conformance runs through the plateau-hosted binding over the WE vector corpus (#1918). Confirmed zero executable consumers before deleting: no `.ts`/`.mjs`/`.test.ts` imports `we:analytics/provider.ts`; the `@webeverything/contracts/analytics` entry (`we:contracts/analytics.ts`) re-exports type-only from `we:analytics/contract.ts`, not from provider; `we:demos/analytics-conformance-demo.ts` names `NoopTracker` only in a prose comment (it embeds the plateau iframe, no import). WE retains `we:analytics/contract.ts`, `we:analytics/dev-metrics.ts`, and the vector corpus under `we:src/_data/analytics/` — the #1282 zero-executable analytics end-state.
