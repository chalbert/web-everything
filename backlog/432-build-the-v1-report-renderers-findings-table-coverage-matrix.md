---
type: idea
workItem: story
size: 3
parent: "350"
status: resolved
blockedBy: ["431"]
dateOpened: "2026-06-12"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: blocks/renderers/report
tags: []
---

# Build the v1 report renderers — findings table + coverage matrix

Build the v1 reusable renderers over the report model: a findings table and a coverage matrix, fixture-driven and auto-rendered the way /protocols/ and /intents/ catalogs render from JSON. These two cover check:standards (findings) and check:app-conformance (coverage); trend/burndown and score-card renderers follow once a producer emits series data. Phase 2 of #350; consumes the report model (#431).
