---
bornAs: x1sd02j
kind: story
size: 3
parent: "3383"
status: open
blockedBy: ["3996"]
dateOpened: "2026-09-23"
tags: []
---

# Planner build: exploration as one router rule (candidate table, fleet-wide daily cap)

Child 7 of #3922. While a task type has no qualifying non-Claude model, a low-risk, testable, in-envelope, non-statute step goes to the next model on an ordered candidate table (Gemini Flash, then Codex), capped by explorationPerDay per task type counted fleet-wide with an atomic check-and-increment. The routing record keeps routed, sets executed, marks exploration true.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
