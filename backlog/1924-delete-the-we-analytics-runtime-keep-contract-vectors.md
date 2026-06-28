---
kind: story
size: 2
parent: "1294"
status: open
blockedBy: ["1921"]
dateOpened: "2026-06-28"
tags: []
---

# Delete the WE analytics runtime (keep contract + vectors)

Slice 4 of the analytics relocation cascade (#1294). Delete the executable analytics runtime from WE (we:analytics/provider.ts) now that fui:analytics hosts it and conformance is proven from the binding+vectors. WE retains we:analytics/contract.ts + the vector corpus — the #1282 zero-executable end-state for analytics. Mirrors webpolicy W4 (#1802).
