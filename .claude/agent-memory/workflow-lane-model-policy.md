---
name: workflow-lane-model-policy
description: Parallel /workflow lane execution model — Sonnet default, Opus for rare complex items, never Fable
metadata:
  type: feedback
---

Lane (per-item execution agent) model in the parallel /workflow orchestrator: **Sonnet by default, Opus only for rare genuinely-complex items, and NEVER Fable for execution.** The orchestrator itself decides per item — the main loop should not have to pass a model each run.

**Why:** the first #1974–2184 batch (2026-07-03) launched with lanes inheriting the session model (Fable 5) and all 24 died mid-work on "out of Fable 5 usage credits." Fable is the expensive/limited premium pool; execution grunt-work should never touch it. Sonnet handles the vast majority of batchable items and is a separate, cheaper pool; the PR required test check is the quality floor regardless (the drain never merges red), so the cheap model never has the final say.

**How to apply:** implemented in .claude/skills/batch-backlog-items/parallel-execute.workflow.js — the light probe now emits a per-item complex boolean (default false → Sonnet; true → Opus, meant to be rare), and the lane agent ALWAYS passes an explicit model (laneModelFor(it)) so it never inherits a Fable session model. An explicit laneModel arg still overrides the default tier but is force-floored off Fable. Probe + report/orchestration stay on the inherited (main-loop) model — that is Opus-class, not execution. Relates to [[parallel-orchestrator-first-real-multilane-run]].
