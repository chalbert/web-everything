---
type: idea
workItem: story
size: 3
parent: "1143"
status: open
dateOpened: "2026-06-19"
tags: []
---

# Live-validate /batch --parallel on a real multi-lane batch

The #1147 orchestrator (we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js) is structurally verified but NOT exercised live. Validate it on a real /batch --parallel run whose ready pool genuinely spans independent subsystems (provably-disjoint file sets across lanes): confirm the effect-probe + partition produce correct lanes, worktree lanes gate green locally, the serial integrator merges one-at-a-time with a full gate per merge, a deliberately-overlapping pair triggers the conflict->serial-replay fallback (not a force-merge), and derived artifacts (we:AGENTS.md, we:src/_data/referenceIndex.json) regenerate exactly once. This is the keystone proof epic #1143 waits on; until it passes, --parallel degrading to serial is the safe expectation.
