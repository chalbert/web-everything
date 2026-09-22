---
bornAs: xktw9vz
kind: story
size: 5
parent: "3383"
status: open
blockedBy: ["3871"]
scope: ["we:skills-src/conveyor/supervisor.mjs"]
dateOpened: "2026-09-22"
tags: []
---

# Build the Supervisor manifest launcher (spawns one unmodified we:supervisor.mjs per manifest entry)

we:skills-src/conveyor/supervisor.mjs's restart/backoff core already takes an injected child (runSupervisorLoop, line 189; makeRealSpawnChild, line 422; main, line 587) -- no internal rewrite is needed to run more than one. Build a thin top-level launcher that reads #3871's daemon manifest and starts one existing, UNMODIFIED we:skills-src/conveyor/supervisor.mjs process per entry, rather than teaching we:skills-src/conveyor/supervisor.mjs to manage N children internally. The launcher's own script-resolution must use the SAME closed allowlist #3871 defines for we:skills-src/conveyor/pass-daemon.mjs, generalized to every entry it can launch (Dispatcher, Fix-dispatch, Review, Verify, each of the 8 watchers), never an arbitrary path. Part of daemonizing the conveyor runner under epic #3383; see #3860 for the design context.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
