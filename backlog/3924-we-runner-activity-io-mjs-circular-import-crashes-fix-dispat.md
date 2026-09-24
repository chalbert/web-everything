---
bornAs: xpf964v
kind: task
parent: "3383"
status: resolved
scope: ["we:scripts/operations/runner-activity-io.mjs"]
dateOpened: "2026-09-22"
dateStarted: "2026-09-22"
dateResolved: "2026-09-22"
tags: []
---

# we:runner-activity-io.mjs circular import crashes fix-dispatch daemon at startup

we:scripts/operations/runner-activity-io.mjs imports RECONCILE_FIX_DISPATCH_LEASE_KEY from we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs and REVIEW_DAEMON_LEASE_KEY from we:skills-src/conveyor/review-daemon.mjs to build KNOWN_DAEMONS. Live-caught 2026-09-22: running we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs directly throws ReferenceError: Cannot access RECONCILE_FIX_DISPATCH_LEASE_KEY before initialization, because that daemon transitively imports we:scripts/operations/run.mjs (via we:scripts/conveyor/reconcile-fix-dispatch.mjs -> we:scripts/operations/dispatch-abort.mjs -> we:scripts/operations/wake.mjs -> we:scripts/operations/run.mjs), which imports we:scripts/operations/runner-activity-io.mjs, which imports back into the still-initializing daemon module -- a real ESM circular-import TDZ crash, confirmed by direct reproduction, not a mock. Fix: we:scripts/operations/runner-activity-io.mjs's own header already says these lease keys are internal plumbing a consumer should not need to know -- so it should hold its own local literal-string table for KNOWN_DAEMONS instead of importing the constants from each daemon module, breaking the cycle at its root rather than reordering imports.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
