---
kind: epic
parent: "4376"
status: open
dateOpened: "2026-10-02"
tags: []
---

# Compare providers fairly: record each launch outcome the same way, run a small paired sample, show it in Plateau

Operator, 2026-10-02: "do we have any data on how Claude vs Codex perform?" Not usable today: the run scorecards (about 7,500 records) score different roles per provider (Claude: required reviews, fixes, CI heals; Codex: advisory reviews, builds, prepares), most build, fix and heal records carry no outcome (99 Codex probation launches with none; 82 percent of Claude fixes and 90 percent of CI heals unclassified), and advisory scores are a constant 100. Design to prepare: (1) one outcome record per launch for every provider and role: landed or not, review rounds to accept, rework or stand-down, wall time, tokens and cost, operator interventions; (2) a small weekly paired sample: the same task kind dispatched to two providers on comparable cards, scored by the same rubric; (3) a Plateau view comparing providers per role and task kind, which routing policy can read. Builds on the per-launch model and effort audit from the #3311 routing work.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
