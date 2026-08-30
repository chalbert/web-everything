---
kind: task
parent: "3383"
status: open
dateOpened: "2026-08-30"
relatedTo: ["2453", "3403"]
tags: [conveyor, lease, timing, flagged-by-review]
---

# Runner singleton lease is not heartbeated during mechanicalPasses, so a long verify-dispatch pass can let it go TTL-stale mid-run

Surfaced by a blind independent design review of `#3383` (2026-08-30), not yet filed until now.
`we:skills-src/conveyor/runner.mjs`'s `runLoop` calls its effects in this order each tick: `tickOnce`
→ `emit` → `dispatchPass` → `mechanicalPasses` → `shouldStop` check → `heartbeat()` → `sleep`. The
singleton lease is extended ONLY at that one `heartbeat()` call, which sits AFTER `mechanicalPasses`
returns — and `mechanicalPasses` (`makeCliMechanicalPasses`) runs the `#3105` verify-dispatch pass last,
whose own doc comment says plainly it "can legitimately run for as long as the gate itself takes
(150–350s, sometimes longer): it is a full `we:verify-lane.mjs` run, not a quick bookkeeping sweep...
nothing about the runner's own loop is bound by a per-turn window."

If that pass runs longer than the lease's TTL, the lease goes stale WHILE this runner is still alive and
working, and `we:skills-src/conveyor/runner-lock.mjs`'s stale-reclaim path lets a second runner start
believing it holds the sole-driver right — the exact double-driver window `#2453` already fixed for the
plateau-app drain daemon's own whole-process lease (`heartbeatDrainLease` used to run only per watch pass,
same shape: "a full sweep running past the lease TTL goes stale mid-run and a concurrent drain reclaims
it"). This is a DIFFERENT bug from `#3403` (the build in-flight GUARD's bookkeeping has no durable floor
across a crash-restart) — this one is about the SINGLETON LEASE itself going stale during a single still-
running process, no crash or restart involved.

## Where

`we:skills-src/conveyor/runner.mjs`'s `runLoop` (the tick loop), and `makeCliMechanicalPasses`'s
ordering — the verify-dispatch pass runs synchronously inside the same `mechanicalPasses()` call the loop
awaits before ever reaching `heartbeat()`.

## Done when

1. **Executable** — a test on `we:skills-src/conveyor/__tests__/runner.test.mjs` proves `runLoop` calls
   `heartbeat` at least once during a single tick whose `mechanicalPasses` effect takes longer than the
   lease's TTL (a fake slow `mechanicalPasses` + a fake `heartbeat` counter) — fails today (zero heartbeat
   calls until the pass returns), passes once a mid-pass heartbeat exists.
2. Mirrors `#2453`'s own fix shape: heartbeat is threaded INTO the long-running effect (e.g. `runLoop`
   passes a `heartbeat` callback into `mechanicalPasses`/the verify-dispatch pass itself, called
   periodically during the gate run) rather than only bracketing it — a single heartbeat call placed
   between `dispatchPass` and `mechanicalPasses` would still miss a pass that is ITSELF longer than one
   TTL.
3. Cites `#2453` as the precedent and stays disjoint from `#3403` (cross-linked, not duplicated).
