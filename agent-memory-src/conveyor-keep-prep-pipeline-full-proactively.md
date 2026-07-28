---
name: conveyor-keep-prep-pipeline-full-proactively
description: Proactively and continuously keep the conveyor prep pipeline full (scope, slice, prepare-decision, research) without waiting to be told; refill as work completes
metadata:
  type: feedback
---

The operator wants the conveyor's PREP pipeline kept full autonomously — keep preparing stories (writing `scope:` for needs-scope items, slicing cleanly-sliceable unsliced epics, preparing + previewing decisions, researching) continuously, refilling as items complete, WITHOUT being told each wave. Operator, 2026-07-28: *"also keep preparing stories (scope, research, decision, etc.) without me having to tell you."*

**Why:** the point is a self-feeding pipeline. Idle lanes plus a starved prep queue mean the operator has to nudge ("queue more", "are you working on the needs scope?") instead of the pipeline flowing on its own. Prep work is naturally parallel-safe — each prepare-scope / slice / prepare-decision touches ONE distinct backlog file — so it is low-risk to keep several running.

**How to apply:** treat prep as a STANDING background activity, refilled proactively:
- needs-scope items exist → dispatch prepare-scope agents (each writes one item's `scope:` as a one-file PR);
- unsliced epics are cleanly sliceable (not design-gated) → slice them into buildable stories;
- unprepared decisions accumulate → prepare + render a preview artifact for the operator to rule;
- research gaps → dispatch research.

**The trigger is pipeline-drop.** Each time the pipeline drops — idle lanes, an empty/thin ready queue, a wave completing — that IS the cue to review the backlog for what can be prepared next (scope, slice, prepare-decision, research) and refill. Don't wait to be asked; the drop is the signal. The recurring ~5-min status refresh is a convenient heartbeat to notice a drop against. Operator, 2026-07-28: *"each time it drops, good idea to review when can be prepared."*

Refill when a wave completes; don't wait for permission to file/prepare buildable work (that's already established — [[conveyor-file-decisions-not-inline-questions]]). Keep hand-dispatching (interim spawner) until the agent-runner backend (#2464) makes it mechanical and the runner keeps the queue full itself. Build dispatches still respect scope-collision; prep does not.
