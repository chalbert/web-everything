---
name: workflow-lane-model-policy
description: Parallel /workflow lane execution model — Sonnet default, Opus for rare complex items, never Fable
metadata:
  type: feedback
---

Lane (per-item execution agent) model in the parallel /workflow orchestrator: **Sonnet by default, Opus only for rare genuinely-complex items, and NEVER Fable for execution.** The orchestrator itself decides per item — the main loop should not have to pass a model each run.

**Why:** the first #1974–2184 batch (2026-07-03) launched with lanes inheriting the session model (Fable 5) and all 24 died mid-work on "out of Fable 5 usage credits." Fable is the expensive/limited premium pool; execution grunt-work should never touch it. Sonnet handles the vast majority of batchable items and is a separate, cheaper pool; the PR required test check is the quality floor regardless (the drain never merges red), so the cheap model never has the final say.

**Refinement — operator, 2026-09-22:** *"Opus should only be used for design of hard stuff and delegate tasks to subagent normally."* (Said after: "I am surprised I had to explain the opus target, this is far from new.") This applies to EVERY orchestrating session and every worker it dispatches, not only `/workflow` lanes. Concretely:

- **Sonnet = every execution job:** filing, reviews, builds, ports, data refreshes, doc corrections, and security fixes once the design is settled.
- **Opus = DESIGN of hard stuff only:** decision forks, architecture and slicing, statute or rule wording. An Opus worker does not execute: it delegates the execution to subagents with an explicit `model: sonnet` (`model: haiku` for pure reads) and verifies what comes back ([[always-set-subagent-model-explicitly]], [[delegate-by-default-the-loop-only-orchestrates]]).
- **Escalate Sonnet → Opus only after Sonnet reports it could not do the job.** Not on a guess that the item is hard.
- **Never Fable for execution.** Where the router allows, hand the job to Codex or Gemini ([[model-tier-for-codex-gemini-wrapper]]).
- **Never hand-set the model for a batch of workers** (an env var, a private handoff note). The tier is chosen per job by this rule. If an operation limits that, fix the operation on the prototype ([[no-hand-rolling-around-a-missing-operation]]).

**Observed 2026-09-21 (why this is now an always-loaded core line):** about 40 workers were dispatched on Opus by hand, through the process-wide env var `WE_DISPATCH_AGENT_ARGS`, against this rule. A private, unversioned handoff file said "Opus", so it won: the rule sat in recall-gated sub-indexes, not in the always-loaded core block, and no hook or operation checked the model. The rule now has a line in the `MEMORY.md` core invariants; a mechanical check on the dispatched model is still not built.

**How to apply:** implemented in .claude/skills/batch-backlog-items/parallel-execute.workflow.js — the light probe now emits a per-item complex boolean (default false → Sonnet; true → Opus, meant to be rare), and the lane agent ALWAYS passes an explicit model (laneModelFor(it)) so it never inherits a Fable session model. An explicit laneModel arg still overrides the default tier but is force-floored off Fable. Probe + report/orchestration stay on the inherited (main-loop) model — that is Opus-class, not execution. Relates to [[parallel-orchestrator-first-real-multilane-run]].
