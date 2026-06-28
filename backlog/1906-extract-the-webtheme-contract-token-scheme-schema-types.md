---
kind: story
size: 3
parent: "1294"
status: open
dateOpened: "2026-06-28"
relatedProject: webvalidation
relatedReport: reports/2026-06-28-split-analysis-1294-webtheme.md
tags: [relocation, webtheme, conformance]
---

# Extract the webtheme contract (token/scheme schema + types)

T1 of the webtheme relocation cascade (#1294). Carve a pure WE contract for webtheme: the token/scheme schema + types that we:webtheme/{tokens,schemes,defaultTokens,paletteSource}.ts implicitly define, so the resolution runtime can relocate to FUI while WE keeps only the contract + conformance vectors (per #1282). No runtime moves in this slice — it isolates the contract surface the later slices import via @webeverything/contracts. Mirrors webcompliance C1 (#1808).
