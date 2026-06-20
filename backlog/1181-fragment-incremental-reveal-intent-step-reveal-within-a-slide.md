---
type: idea
workItem: story
status: open
size: 3
blockedBy: ["1175"]
dateOpened: "2026-06-20"
relatedProject: webintents
tags: [deck, fragment, reveal, webintents, advanceable-media]
relatedReport: reports/2026-06-19-deck-slide-standards.md
---

# Fragment / incremental-reveal intent — step-reveal within a slide

A finer-than-slide **step-reveal intent**: ordering (fragment index), trigger, reverse traversal on back-nav, and each step as a View Transition without re-animating the whole slide. The overloaded "next" (advance a fragment *or* change slide) is the subtle part. Composes the `view` + `view-transition` standards; homed in **webintents**. Composes the advanceable-sequence family (#1179). *New contract.*

*Carved from epic #1173 under the ratified distributed placement (#1175 → B, no webdecks project); homed by its kin per the contract-inventory table.*
