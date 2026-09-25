---
kind: story
size: 3
parent: "3383"
status: open
scope: ["we:scripts/conveyor/__tests__/sim/world.mjs", "we:scripts/conveyor/__tests__/sim/agent-actions.mjs", "we:scripts/conveyor/__tests__/sim-scenarios-smoke.test.mjs", "we:scripts/conveyor/__tests__/sim-scenario-lane-starvation.test.mjs"]
dateOpened: "2026-09-25"
tags: []
---

# Daemon simulator models the review job, not only claude --bg review sessions

x26lw6u made the review daemon dispatch reviews as a node job (we:scripts/operations/review-job.mjs) instead of a claude --bg session. The daemon simulator scripts every review as a fake session's actions, so we:scripts/conveyor/__tests__/sim/world.mjs pins WE_REVIEW_DISPATCH_MODE=session to keep the tracer and lane-starvation scenarios green. That means the simulator no longer exercises the production review path. Teach the sim to run review jobs (fake review-loop-cli outcome, job records, lane acquire/release) and drop the pin.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
