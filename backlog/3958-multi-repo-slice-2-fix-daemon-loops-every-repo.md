---
bornAs: x1rr9rh
kind: task
parent: "3963"
status: resolved
blockedBy: ["3956"]
scope: ["we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs", "we:scripts/conveyor/reconcile-fix-dispatch.mjs", "we:skills-src/conveyor/review-daemon.mjs"]
dateOpened: "2026-09-23"
dateStarted: "2026-09-23"
dateResolved: "2026-09-23"
tags: []
---

# Multi-repo slice 2: fix daemon loops every repo

we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs calls runReconcileFixDispatch with no repo, so it never looks at frontierui or plateau-app (not even to record them as unsupported). Extract review-daemon's per-repo loop into a shared forEachRepo helper (per-repo failure isolation) and use it here; also run the dispatcher staleness check for every repo, not only when repoKey is we (we:scripts/conveyor/reconcile-fix-dispatch.mjs:586-588) -- the fix runs WE code whatever the target repo.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
