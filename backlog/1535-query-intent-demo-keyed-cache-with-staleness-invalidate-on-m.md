---
kind: story
size: 3
parent: "1460"
status: resolved
blockedBy: ["1534"]
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: "@frontierui/demos/query-intent-demo.html"
locus: frontierui
tags: []
---

# Query intent demo — keyed cache with staleness + invalidate-on-mutation

Build the conformance demo for the query (server-state) intent: a keyed cache exercising fetchPolicy (cache-first / network-only / cache-and-network), staleness display, and invalidate-on-mutation, live-verified on the FUI dev server. Read-path symmetric to the #1395 mutation demo. Cross-repo (locus: frontierui). Slice D of #1460; blockedBy the FUI resource-cache block (C, #1534).

## Resolved (batch-2026-06-22-1545-1549)

`fui:demos/query-intent-demo.html` + `fui:demos/query-intent-demo.ts` — a conformance playground driving the
real `InMemoryResourceCache` (#1534) through five read-path invariants: cache-first, staleness (freshWindow
fresh→stale, SWR), cache-and-network (serve stale + revalidate), network-only (forced refetch), and
invalidate-on-mutation (dependsOn cascade). **Live-verified on :3001**: `playgroundReady`, 5/5 badges green,
0 console errors. Auto-registers in `/demos/` (the `fui:src/_data/demos.js` scan). Read-path symmetric to the #1395 mutation
demo. frontierui `check:standards` 0 errors.
