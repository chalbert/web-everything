---
type: idea
workItem: story
size: 3
parent: "1143"
status: open
dateOpened: "2026-06-19"
tags: []
---

# Live-validate the parallel batch default over its first real runs

Parallel is now the DEFAULT batch execute model (#1147 orchestrator we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js, flipped on with safety rails: probe-forces-serial-on-uncertainty, integration-branch + single main-agent landing, multiLaneFiles surfacing, conflict->serial-replay). It is structurally verified but NOT yet proven live. This item is the agreed WATCH: over the first few real `/batch` runs that actually split into parallel lanes, confirm via the closing-session audit that the probe+partition produce correct lanes, lanes gate green locally, the integrator merges one-at-a-time onto the throwaway branch with a full gate per merge, an overlapping pair triggers conflict->serial-replay (never a force-merge), the main agent lands the integration branch in ONE merge, multiLaneFiles is empty-or-eyeballed, and derived artifacts regenerate exactly once. Resolve once a few real runs behave; if they misbehave (heavy replay, a wrong multi-lane merge), flip the default back to opt-in (re-title the "Parallel lanes" section of we:.claude/skills/batch-backlog-items/SKILL.md, default to --serial) and record why. Epic #1143 stays open until this settles.
