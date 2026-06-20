---
type: idea
workItem: story
status: resolved
size: 3
blockedBy: ["1175"]
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "intent:fragment-reveal"
relatedProject: webintents
tags: [deck, fragment, reveal, webintents, advanceable-media]
relatedReport: reports/2026-06-19-deck-slide-standards.md
---

# Fragment / incremental-reveal intent — step-reveal within a slide

A finer-than-slide **step-reveal intent**: ordering (fragment index), trigger, reverse traversal on back-nav, and each step as a View Transition without re-animating the whole slide. The overloaded "next" (advance a fragment *or* change slide) is the subtle part. Composes the `view` + `view-transition` standards; homed in **webintents**. Composes the advanceable-sequence family (#1179). *New contract.*

*Carved from epic #1173 under the ratified distributed placement (#1175 → B, no webdecks project); homed by its kin per the contract-inventory table.*

## Progress (batch-2026-06-20-deck)

Authored intent `fragment-reveal` in **webintents** (`we:src/_data/intents/fragment-reveal.json`): finer-than-slide step reveal with `order` (source/index), `traversal` (bidirectional un-reveal vs forward), `step` (view-transition/none) axes. Captures the overloaded-"next" subtlety (reveal next fragment if any remains, else change slide) as the reason it's its own contract. Composes view + view-transition + the #1179 advanceable-sequence family; the `step:none` path is the reduced-motion fallback folded into #1195. Auto-renders at `/intents/fragment-reveal/`.
