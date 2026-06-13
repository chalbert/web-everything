---
type: idea
workItem: story
size: 5
status: open
blockedBy: ["219"]
dateOpened: "2026-06-13"
tags: []
---

# Edge venue — live build-time chunk emission + web-features-backed Baseline lookup

The infra-dependent remainder of #219 (which delivered the pure I/O + caching shell: Sec-CH-UA* parsing, Accept-CH/Critical-CH/Vary, immutable chunk cache headers, injectable BaselineLookup). Two pieces need infra absent from the pure-logic capabilities/ package: (1) a real web-features / Baseline-data-backed BaselineLookup impl (the web-features npm package is not installed; #219 left the lookup injectable rather than invent Baseline data); (2) the live edge runtime that actually BUNDLES and SERVES the resolved component as a real built module at componentUrl over HTTP (EdgeChunkCache today returns a Resolution object, not bytes) — needs an edge server + a bundler/build step. Ties into MaaS distribution #087/#088. DoD: a request with real Client-Hints resolves a droplist to a capability-keyed BUILT chunk served from the edge cache; two UAs in one class share the chunk; a wrong guess degrades.
