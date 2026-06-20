---
type: idea
workItem: story
size: 3
parent: "1210"
status: resolved
blockedBy: ["1175"]
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: reports/2026-06-20-deck-dogfood-readiness-map.md
relatedProject: webdocs
relatedReport: reports/2026-06-20-deck-dogfood-readiness-map.md
tags: [deck, dogfood, readiness-map, analysis]
---

# Deck dogfood readiness map — which deck contracts must ship before rendering

First slice of the dogfood epic #1210: enumerate the #1180–#1198 deck contracts (and #765/#777 boundary) and map each to its current state (spec'd / FUI-implemented / hosted), producing the dependency gate that says which audience deck can render when. Pure analysis; unblocks the rest of #1210.

## Progress (batch-2026-06-20-deck)

Produced the readiness map: `we:reports/2026-06-20-deck-dogfood-readiness-map.md` enumerates all 19 deck contracts (#1180–#1200) with their spec'd / FUI / hosted state and the WE↔FUI boundary (#765/#777). Finding: **spec'd 19/19** (this batch completed the WE layer), **FUI 0/19**, **hosted 0/19** — so #1210 is now gated on a *single FUI deck-component build* against the critical-path 3 contracts (#1180 doc-model, #1191 layouts, #1179 advance) + passing 2 vector suites (#1183, #1195), not on more WE authoring. Everything else is an additive layer. Held items #1184/#1186/#1194 (concept projects) noted; their traps captured as vectors in #1195.
