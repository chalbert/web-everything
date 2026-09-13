---
kind: task
parent: "3383"
status: open
scope: ["we:scripts/operations/fix-dispatch-wrapper.mjs"]
dateOpened: "2026-09-13"
tags: []
---

# dispatchFix leaks its acquired lane when writing the finding-scratch-file throws before its own try/catch

Found 2026-09-13 while fixing a real Codex fix-kind sandbox bug (commit a0d328fb1, lane/mechanical-dispatcher). In we:scripts/operations/fix-dispatch-wrapper.mjs#dispatchFix, once acquireLane succeeds, the very next statement — writeFileSync(lanePath/FIX_FINDING_SCRATCH_FILENAME, ...) — sits OUTSIDE any try/catch: the release-on-failure try block only starts at the following statement (the spanAroundAsyncWithCpu agent-turn call), whose catch calls releaseAllPools before rethrowing. If that writeFileSync throws (e.g. disk full, permission error, a lane whose directory vanished between acquire and write), dispatchFix rethrows with the lane never released — a lane leak on this specific early-failure path, distinct from the already-handled acquireLane-failure and agent-turn-failure branches (both of which DO call releaseAllPools). Fix direction (not done here): fold the finding-scratch-file write into the same try (or its own try/catch that also releases) so every failure after a successful acquire releases the lane.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
