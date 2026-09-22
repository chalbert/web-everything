---
bornAs: xxqa08p
kind: task
parent: "3383"
status: open
scope: ["we:skills-src/conveyor/runner-lock.mjs"]
dateOpened: "2026-09-22"
tags: []
---

# Key we:runner-lock.mjs's lease so more than one daemon can hold a distinct singleton lease

we:skills-src/conveyor/runner-lock.mjs hardcodes its lease sentinel (RUNNER_LEASE_PATH, line 47) and threads it unparameterized through makeOwner/runnerOwner (lines 57,59) and acquireRunnerLease/heartbeatRunnerLease/releaseRunnerLeaseIfOwned (lines 72,80,88, plus internal reads at 74,81,83,89,90,102). Add an optional key parameter to all of these, defaulting to today's constant string so existing callers are unaffected, so a second daemon (see #3860's sibling slices) can take its own distinct singleton lease from the same primitive. Part of daemonizing the conveyor runner under epic #3383; see #3860 for the design context.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
