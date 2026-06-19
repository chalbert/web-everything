---
type: idea
workItem: story
size: 8
parent: "1143"
status: open
blockedBy: ["1144", "1145"]
dateOpened: "2026-06-19"
tags: []
---

# Workflow-driven /batch --parallel: effects-manifest + serial integrator

Wire the opt-in /batch --parallel onto the Workflow tool. The main loop keeps the conversational pack/plan/one-go and the close-out/calibration; Workflow runs only the execute phase and returns a ledger. The keystone safety move: lane agents never splice shared registries — they return a registry-effects manifest that one serial integrator applies after merge.

Shape: per-item effect-probe -> partition on the UNION of predicted touch-sets (frontmatter is a lower bound) -> orchestrator reserves+claims the whole pack in one context (kills the `we:.claude/skills/batch-backlog-items/reservations.json` race) -> `parallel()` lane agents in `isolation:worktree` that touch ONLY their own code + their own `we:backlog/NNN.md` and RETURN a registry-effects manifest, running the per-lane LOCAL gate (#1144) -> barrier -> a serial integrator agent applies each manifest one at a time, runs the FULL gate per merge, and replays a lane serially on conflict/red. `budget.remaining()` = the points budget (sole stop). Reliability-first barrier (parallel-all then serial-integrate); streaming integrate is a later optimization.
