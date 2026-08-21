---
bornAs: xnjm6y6
kind: task
parent: "3029"
status: open
blockedBy: ["3224"]
dateOpened: "2026-08-21"
tags: []
---

# Backfill: wire the 11 declared operations into the 21 skills that describe their steps

The backfill under the new gate. Measured 2026-08-21: claim, dispatch-lane, explore, gate-health and review-prep are named by no skill at all; dispatch-lane 0 skills vs we:scripts/lane-pool.mjs 14; stage-pr-view 1 vs gh pr view/diff 8; open-pr and review-pr 1 each vs we:scripts/pr-land.mjs and we:skills-src/jury/panel-fanout.mjs 6 each. Includes we:skills-src/next-backlog-item/SKILL.md line 189, which still instructs we:scripts/backlog.mjs claim while the claim operation exists — the clearest proof of the mechanism, since that session made 11 raw claim calls and 0 through the operation.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
