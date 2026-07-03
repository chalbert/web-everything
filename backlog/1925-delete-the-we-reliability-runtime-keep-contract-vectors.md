---
kind: story
size: 2
parent: "1294"
status: resolved
blockedBy: ["1922"]
dateOpened: "2026-06-28"
dateStarted: "2026-07-03"
dateResolved: "2026-07-03"
tags: []
---

# Delete the WE reliability runtime (keep contract + vectors)

Slice 4 of the reliability relocation cascade (#1294). Delete the executable reliability runtime from WE (we:reliability/provider.ts, we:reliability/registry.ts) now that fui:reliability hosts it and conformance is proven from the binding+vectors. WE retains we:reliability/contract.ts + the vector corpus — the #1282 zero-executable end-state for reliability. Mirrors webpolicy W4 (#1802).
