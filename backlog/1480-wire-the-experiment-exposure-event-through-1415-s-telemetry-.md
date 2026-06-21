---
kind: story
size: 2
parent: "099"
status: open
blockedBy: ["1415", "1479", "1476"]
dateOpened: "2026-06-21"
tags: []
---

# Wire the experiment exposure event through #1415's telemetry sink

Ratified by #1414 (Fork 3). The experiment intent DECLARES the exposure; #1415's swappable telemetry sink DELIVERS it — a named seam, not a merge (mirrors OpenFeature's Tracking⊥Evaluation split). Residual to settle: the ordering guarantee — the exposure must fire before the arm's effect is measured; decide whether that needs a contract beyond #1415's emit.

Blocked on #1415 (the sink contract), #1479 (the intent that declares the exposure), and #1476 (the vocabulary entry). #1476 adds the experiment-exposed event to the Analytics Event Vocabulary protocol; this item is the intent-side wiring that emits it — a distinct parallel track, not a merge.
