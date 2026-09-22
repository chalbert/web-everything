---
kind: story
size: 5
parent: "3383"
status: open
blockedBy: ["x3fixx3"]
scope: ["we:scripts/conveyor/branch-drift.mjs", "we:scripts/conveyor/ci-queue-watch.mjs", "we:scripts/conveyor/parked-pr-conflict-watch.mjs", "we:scripts/conveyor/parked-pr-progress-watch.mjs", "we:scripts/conveyor/duplicate-pr-watch.mjs", "we:scripts/conveyor/lane-pool-health-watch.mjs", "we:scripts/conveyor/poc-branch-sync.mjs", "we:scripts/conveyor/infra-blocked.mjs", "we:skills-src/conveyor/runner.mjs"]
dateOpened: "2026-09-22"
tags: []
---

# Wire all 8 watcher passes onto we:pass-daemon.mjs, one manifest entry each

All 8 watcher passes -- we:scripts/conveyor/branch-drift.mjs, we:scripts/conveyor/ci-queue-watch.mjs, we:scripts/conveyor/parked-pr-conflict-watch.mjs, we:scripts/conveyor/parked-pr-progress-watch.mjs, we:scripts/conveyor/duplicate-pr-watch.mjs, we:scripts/conveyor/lane-pool-health-watch.mjs, we:scripts/conveyor/poc-branch-sync.mjs, we:scripts/conveyor/infra-blocked.mjs -- already carry their own separate advisory/lease lock (or need none), confirmed by direct read: none calls the shared tick mutex. we:scripts/conveyor/ci-queue-watch.mjs uses withHistoryLock, we:scripts/conveyor/infra-blocked.mjs uses withInfraLock (its own header reasons about concurrent writers), we:scripts/conveyor/poc-branch-sync.mjs uses withPocLandLock (shared with a real PR landing), we:scripts/conveyor/lane-pool-health-watch.mjs has a TOCTOU re-check gating its own mutation; the rest need no lock. Wire all 8 onto #x3fixx3's we:skills-src/conveyor/pass-daemon.mjs as one manifest entry each, own interval per entry, kept as ONE slice (not 8 separate cards) since each entry is a near-identical, small manifest wiring -- fragmenting further would just multiply review overhead for repetitive work. Only we:scripts/conveyor/infra-blocked.mjs (can block for minutes on its own resumeOpen call) was proven to need isolation from the others; the granularity itself (8 independent daemons vs. fewer groups) is sized to the operator's explicit ask for independent restart/versioning of any single piece, stated honestly rather than implied as a correctness requirement. Drop each from we:skills-src/conveyor/runner.mjs's own mechanicalPasses list as it bakes. Part of daemonizing the conveyor runner under epic #3383; see #3860 for the design context.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
