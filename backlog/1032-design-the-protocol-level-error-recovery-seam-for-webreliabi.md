---
type: decision
workItem: story
size: 5
parent: "1019"
status: open
dateOpened: "2026-06-19"
tags: []
---

# Design the protocol-level error-recovery seam for webreliability

Decision card de-burying the error-recovery GAP flagged in webreliability impl epic #1019. webreliability's recovery-handler registry (lineage #011 / #028 / #101 / #503) has resolved design and can build; but the protocol-level error-recovery — how failures are classified, retried, backed off, surfaced, and composed across registered handlers — has NEITHER design NOR impl (a true gap per the #1008 triage). This card decides the error-recovery contract shape (contract to @webeverything, runtime to FUI) BEFORE #1019 builds its error-recovery slice. Open until ratified; prepare via /prepare when picked up.
