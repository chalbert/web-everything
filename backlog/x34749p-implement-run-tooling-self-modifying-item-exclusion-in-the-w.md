---
kind: story
size: 5
status: open
blockedBy: []
dateOpened: "2026-07-10"
tags: []
---

# Implement RUN_TOOLING self-modifying-item exclusion in the /workflow partition

Build arm of decision #2077. Add a declared RUN_TOOLING pathspec + isRunTooling()/selfModifying() to the canonical, unit-tested we:scripts/readiness/lane-partition.mjs (inline-mirrored in the workflow sandbox), matched against each probe's predicted touch-set at Phase 1 after probes and before the Phase-2 pre-claim, so a self-modifying item is dropped with nothing claimed. Scope = full run-tooling surface (skill dir + shelled scripts: we:scripts/backlog.mjs, we:scripts/lane-pool.mjs, we:scripts/readiness/*, we:scripts/push-if-green.mjs, we:scripts/backlog-renumber-collisions.mjs, we:scripts/dev/render-check.mjs); exclude batch state files and build config. Three detection seats: probe-time front door, post-hoc changedFiles check at integrate (carry refs, dont merge), serial-lane prompt stop-revert-report guard. Plus a coverage-parity unit test that walks TRANSITIVE shell-outs from the workflow source and asserts RUN_TOOLING covers them. Interim routing: drop from /workflow, work solo or LAST in serial /batch. Ruling codified under the pr-flow-rollout-mechanism statute.
