---
kind: story
size: 2
parent: "099"
status: open
blockedBy: ["1415", "1479"]
dateOpened: "2026-06-21"
tags: []
---

# Wire the experiment exposure event through #1415's telemetry sink

Ratified by #1414 (Fork 3). The experiment intent DECLARES the exposure (event name + variant payload from a controlled vocabulary); #1415's swappable telemetry sink DELIVERS it — a named seam between two intents, not a merge (mirrors OpenFeature's Tracking⊥Evaluation split). Blocked on #1415 (the sink contract) and #1479 (the intent that declares the exposure). Residual to settle here: ordering guarantee — the exposure must fire before the arm's effect is measured; decide whether that needs a contract beyond #1415's emit.
