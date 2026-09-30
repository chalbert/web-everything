---
bornAs: xfmxjlr
kind: story
size: 3
status: open
scope: ["we:scripts/conveyor/build-dispatch-orphan-adopt.mjs", "we:skills-src/conveyor/build-dispatch-daemon.mjs", "we:scripts/conveyor/__tests__/build-dispatch-orphan-adopt.test.mjs", "we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# Reconcile dead build run records even after their dispatch claim disappears

The #4620 run stayed in flight after its wrapper died because adoption iterates claims only, while build occupancy reads unstamped run records. A released claim makes that durable run invisible to reconciliation until its clock deadline expires.

## Evidence

we:scripts/conveyor/build-dispatch-orphan-adopt.mjs:436; we:skills-src/conveyor/build-dispatch-daemon.mjs:731; we:scripts/operations/dispatch-lane.mjs:704. Full incident evidence: we:reports/2026-09-30-builder-launch-misread-root-causes.md.

## Design

Reconcile the union of build claims and durable build dispatch rows, deduplicated by attempt. Probe wrapper identity and process liveness before classifying rows; retain unknown cases and live workers. Persist a terminal finding for confirmed dead attempts without claims. Never release a re-leased foreign lane or adopt work from a different attempt. Separate reconciliation from any fresh scheduling decision; a missing claim is not permission to restart.

## Done when

1. An integration probe uses a real temporary store, an exited disposable child PID, no claim, and a lane leased to a different session. The next ordinary reconciliation persists the dead attempt and removes phantom occupancy without any spawn or lease mutation. A live child and unavailable liveness each remain protected; repeated ticks are idempotent.
2. Soak break: stop active changes for at least 30 minutes and at least three naturally scheduled observer ticks after the controlled child exits. Observe zero phantom slots, duplicate spawns or changes to the replacement lease, and attach timestamped run/claim/lease evidence before and after the break.

## Follow-ups

The diagnosis-only lane could not run its gates: the sandbox denied the verifier marker and the standards admission lock. Run both gates in the implementing lane with normal repository permissions; do not bypass either.

Keep serializer-to-consumer and process-lifecycle probes at the real boundary; helper-only fixtures did not reveal this incident. Record testing lessons here, not in shared agent documentation.
