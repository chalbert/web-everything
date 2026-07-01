---
kind: story
size: 5
parent: "1451"
status: active
dateOpened: "2026-07-01"
dateStarted: "2026-07-01"
tags: []
---

# Build the Floating UI positioning adapter behind the #149 DI seam

The #149 DI seam ships a swappable positioning-strategy provider but leaves the Floating UI provider as an owed fallback impl; the registry entry is status:concept. Wire Floating UI as the JS-fallback positioning provider and promote the adapter concept→implemented.

## Lineage
Surfaced 2026-07-01 in the first #1451 (Library-adapter watch) goal-completeness pass — the program had 0 adapter-build children and this adapter sits at status:concept behind the #149 seam. Report: [we:reports/2026-07-01-program-library-adapter-watch.md](../reports/2026-07-01-program-library-adapter-watch.md).
