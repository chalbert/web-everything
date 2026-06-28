---
kind: story
size: 2
parent: "1294"
status: open
blockedBy: ["1920"]
dateOpened: "2026-06-28"
tags: []
---

# Delete the WE intl runtime (keep contract + vectors)

Slice 4 of the intl relocation cascade (#1294). Delete the executable intl runtime from WE (we:intl/provider.ts, we:intl/registry.ts) now that fui:intl hosts it and conformance is proven from the binding+vectors. WE retains we:intl/contract.ts + the vector corpus — the #1282 zero-executable end-state for intl. Mirrors webpolicy W4 (#1802).
