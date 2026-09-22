---
bornAs: x1yfzce
kind: story
size: 5
parent: "3383"
status: resolved
scope: ["we:scripts/conveyor/reconcile-fix-dispatch.mjs", "we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs", "we:skills-src/conveyor/runner-lock.mjs"]
dateOpened: "2026-09-22"
dateStarted: "2026-09-22"
dateResolved: "2026-09-22"
tags: []
---

# Extract the Fix-dispatch daemon (we:reconcile-fix-dispatch.mjs) to run standalone

we:scripts/conveyor/reconcile-fix-dispatch.mjs already fences its own resume-or-dispatch decision per PR through we:scripts/operations/action-store.mjs's durable, atomic (fs.openSync(path,'wx')) per-resource claim ledger, independent of the shared tick mutex -- confirmed cross-process-safe by direct read.

## Progress

Built we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs — a standalone loop (`runDaemonLoop`, pure core / IO shell, mirroring we:skills-src/conveyor/runner.mjs's own shape) that ticks `runReconcileFixDispatch` every 120s (matching the runner's own prior cadence), isolating a single tick's failure so a transient hiccup never kills the daemon. Takes its own keyed runner-lock lease (#3877's `key` parameter, its own distinct sentinel) — NOT because this pass needs a lease for correctness (the action-store ledger already makes two concurrent copies safe by construction), but purely so a second accidental launch no-ops instead of wastefully racing the ledger. Does **not** yet drop the pass from we:skills-src/conveyor/runner.mjs's own mechanicalPasses list — this is the "stand it up, bake it" half of the rolling cutover; both run concurrently and safely for the same reason two copies of just this daemon would.

## Done when

1. **Executable** — `npx vitest run we:skills-src/conveyor/__tests__/reconcile-fix-dispatch-daemon.test.mjs` passes (8/8): the pure loop ticks/sleeps/stops on `maxTicks`, isolates a failing tick (never fatal), and stops immediately (no further sleep or tick) the moment its heartbeat reports the lease lost.
