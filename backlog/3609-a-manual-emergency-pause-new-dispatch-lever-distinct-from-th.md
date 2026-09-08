---
bornAs: xo94b41
kind: story
size: 3
parent: "3383"
status: open
scope: ["we:scripts/readiness/dispatch-plan.mjs", "we:scripts/conveyor/tick-core.mjs", "we:scripts/readiness/dispatch-pause.mjs"]
dateOpened: "2026-09-07"
tags: []
---

# A manual/emergency pause-new-dispatch lever, distinct from the automatic MAX_CONCURRENT_LANES cap

Sibling of 3612 (we:backlog/3612-cap-concurrent-dispatched-lanes-with-a-max-concurrent-lanes.md, the automatic concurrent-lane admission ceiling filed the same night from the 2026-09-07 42-lane/load-34.95 incident). Confirmed missing by reading we:scripts/readiness/dispatch-plan.mjs and we:scripts/conveyor/tick-core.mjs in full: neither has any 'pause new dispatch, let in-flight finish' control — no flag, env var, or state file either module checks before launching new work. This is a DIFFERENT capability from an automatic cap: MAX_CONCURRENT_LANES is a standing ceiling the dispatcher always respects; this item is a manual/emergency lever an operator (or a future automatic overload detector) flips to stop ALL new dispatch immediately — builds, prepare-scope, prepare-decision, fix, and ci-heal spawns alike — while letting already-running lanes finish normally, then resumes once cleared. Precedent for the shape already exists in this repo: we:scripts/readiness/infra-blocked.mjs is a single-holder advisory state file gating a degraded external dependency, and we:scripts/conveyor/branch-drift.mjs's drift-blocked verdict already holds NEW dispatch over a scope without touching in-flight lanes — this item is the same 'read one small advisory file/verdict at plan time, hold new launches, never touch what is already running' shape, generalized to a single kill-switch for ALL new dispatch rather than one scope. Suggested shape: a small state file (mirroring we:scripts/readiness/infra-blocked.mjs's own persistence) that we:scripts/readiness/dispatch-plan.mjs#dispatchPlan and we:scripts/conveyor/tick-core.mjs#planTick both check before computing ANY launch/spawn list, holding every otherwise-launchable item with a new, distinct reason (e.g. 'dispatch-paused') when set, and a small CLI (set/clear/status) to flip it — an operator's fast, deliberate override that needs no cap tuning, for the moment the ceiling alone is not enough (e.g. the machine is already loaded for an unrelated reason). Not required to land the automatic cap (3612) — filed separately per the operator's own framing of the two as related but distinct.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
