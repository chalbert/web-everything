---
kind: story
size: 2
parent: "1294"
status: resolved
blockedBy: ["1909"]
dateOpened: "2026-06-28"
dateStarted: "2026-07-02"
dateResolved: "2026-07-02"
graduatedTo: "fui:webtheme/ (runtime, #1907) — WE keeps webtheme/contract.ts + conformance-vectors/webtheme.vectors.ts; consumers repointed to the @frontierui/webtheme dev-time alias"
tags: []
---

# Delete the WE webtheme runtime (keep contract + vectors)

T5 of the webtheme relocation cascade (#1294). Delete the executable webtheme runtime from WE (we:webtheme/{tokens,compile,schemes,defaultTokens,paletteSource}.ts) now that fui:webtheme hosts it and conformance is proven from the binding+vectors. WE retains only the contract (T1 #1906) + the vector corpus (T3 #1908) — the #1282 zero-executable end-state for webtheme. Mirrors webcompliance C5 (#1815).
