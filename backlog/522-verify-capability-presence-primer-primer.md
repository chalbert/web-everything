---
kind: task
parent: "495"
status: resolved
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: none
tags: []
---

# Verify capability presence — Primer (primer)

Per-source slice of #495: walk the Primer docs (https://primer.style/) and confirm presence for each of the 96 benchmark capabilities, then splice rows into we:benchmarkCapabilityPresence.json for sourceId primer — upgrade the notable-inference seed rows in place to provenance verified with the deep doc URL and the vendor sourceName, and insert newly-found present capabilities. Never rewrite the whole file; splice only this source's rows so re-runs diff cleanly. Method and validator were settled by foundation #352. Independent of every other source slice.

## Progress (2026-06-13) — resolved

Walked the GitHub Primer docs (primer.style — components, primitives, accessibility design-guidance) and spliced **54 verified rows** into `we:benchmarkCapabilityPresence.json` for `primer` (3 seed rows upgraded in place + 51 new, deep doc URLs + Primer's own names, e.g. Blankslate, CounterLabel, NavList). Conservatively omitted capabilities with no Primer page. `check:standards` green.
