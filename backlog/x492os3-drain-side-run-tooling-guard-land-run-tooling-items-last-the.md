---
kind: story
size: 5
status: open
dateOpened: "2026-07-10"
tags: []
---

# Drain-side RUN_TOOLING guard: land run-tooling items last + the RUN_TOOLING vocabulary/drift-test (steady-state residual of #2077)

Steady-state residual of decision #2077. The route-(a) apparatus its build arm #2420 specified was superseded by the #2183 PR-fan-out orchestrator, which dissolved the in-run self-modification hazard (each item edits only its own lane clone; the producer never merges to primary mid-run). Under the deferred-queue substrate the only live risk is in the DRAIN: it shells out to run-tooling (we:scripts/push-if-green.mjs, we:scripts/readiness/*, we:scripts/pr-land.mjs), so a queued item that edits that surface must land LAST in a drain pass (or a dedicated final pass), and the drain must invoke no run-tooling script after landing one; likewise no serial/solo re-route may land a run-tooling change while a /workflow run is live. Build: a RUN_TOOLING pathspec + isRunTooling()/selfModifying() in we:scripts/readiness/lane-partition.mjs grounded in the drain's REAL transitive shell-out set (the #2077 regex list is stale on two axes: #2266 moved the skill dir to skills-src/, and #2183 changed the shell-out surface), a coverage-parity drift test, and the drain-pass ordering. Codified under #pr-flow-rollout-mechanism.
