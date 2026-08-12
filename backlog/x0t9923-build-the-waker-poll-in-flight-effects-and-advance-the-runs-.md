---
kind: story
size: 2
parent: "3029"
status: resolved
scaffoldedBy: "loop-console"
dateScaffolded: "2026-08-12"
dateOpened: "2026-08-12"
dateStarted: "2026-08-12"
dateResolved: "2026-08-12"
tags: [plateau-loop, delivery, operations, engine, dispatch, waker]
scope:
  - we:scripts/operations/effect-observer.mjs
  - we:scripts/operations/wake.mjs
  - we:scripts/operations/__tests__/wake.test.mjs
---

# Build the waker: poll in-flight effects and advance the runs whose work finished

[#3070] ruled WHO wakes a parked run — a dedicated interval job that calls `advance` and nothing else, the
converge daemon's shape rather than the converge daemon, awake-only accepted — and said the build was a
separate story. This is it. [#3073] made a run able to park on work that outlives the process; nothing has
ever asked how that work is going, so a dispatched run parks and stays parked.

## The missing half

The executor has a table of SINKS keyed by effect type: they start work. There is no table for asking how
started work is going. That is the whole shape of this story — an **observer** registry that mirrors the sink
registry, injected the same way, because only the caller knows what a `start.build` handle means.

An observer answers `running`, `applied` or `failed`. `running` is the only non-terminal one and the only safe
default: an observer that cannot tell must say `running`, because the alternative is closing out work that is
still happening.

## What the waker does NOT decide

**Overdue is not dead.** `expectedBy` passing means *go look*, not *give up*. It is an estimate, not a
deadline, and a waker that failed an entry on a clock alone would kill slow-but-healthy work — the exact thing
the three-bucket split in `inFlightEntries` was built to avoid. An overdue entry is observed exactly like a
running one; being overdue changes what a human is told, not what the machine asks.

**A handle-less entry is not polled.** There is nothing to poll. It is reported, never guessed at.

**Failed work is not retried.** `failed` means two opposite things depending on who says it, and reading them
as one word re-ran real work on a timer. The EXECUTOR's `failed` is *"the sink threw `notApplied`, I am certain
nothing landed"* — safe to retry, so the pre-flight lets it through to the sink again. An OBSERVER's `failed`
is *"the work I started RAN, and it failed"* — retrying re-does side-effecting work that already happened.
Writing the second through `resolveInFlight` produced a status whose contract is the first, and the next
`applyPendingEffects` re-dispatched it: unbounded, at timer frequency, with `advanced: false`, no errors and
exit 0, so a supervisor saw a healthy job. One dispatch became five over four passes.

Deciding whether failed work should be retried is a RETRY POLICY, and nothing owns one — so the waker halts,
reports, and leaves it to a person. Re-dispatching is not advancing.

## Why fail-soft, per run

A pass touches every parked run in the store. One unreadable record, one missing observer, or one throwing
observer must not stop the others — a waker that dies the first time one run is odd stops waking everything.
Each fault is collected into the pass report and the pass continues.

## Watch for

- The observation is the ONLY record that the work finished, and an observer may not be able to answer twice
  (a session's transcript is reaped, a build's log rotates). It has to be persisted before anything that could
  crash, `advance` included.
- Advancing past an applied effect step needs `advance`, not another `applyPendingEffects` — the executor does
  not clear `pending`. Looping back into the effect branch applies nothing and spins to the turn cap.
- A dispatch whose resolution leads to ANOTHER dispatch is legitimate. Stop the pass; the next one picks it up.
- `failed` is the executor's word for "safe to retry" and an observer's word for "it ran and it failed". They
  are opposites. Anything that folds an observation into the record has to keep them apart.

## Done when

- [x] An observer table exists, keyed by effect type, injected like the sinks.
- [x] A resolved dispatch lets the run finish and complete, in one pass.
- [x] A still-running one is left exactly as it was.
- [x] One broken run does not stop the pass.

## How it resolved

Two files. `we:scripts/operations/effect-observer.mjs` is the observer half — `planObservations` is pure (what a pass WOULD do,
before doing any of it, with the clock and the table both injected) and `observeRun` folds terminal answers in
through `resolveInFlight`. `we:scripts/operations/wake.mjs` is the pass: scan, observe, persist, advance, report.

`resolveInFlight` gains its first caller, which #1180's reviewer flagged as missing.

NO CONCRETE OBSERVER SHIPS. Nothing in the repo dispatches yet, so a `claude agents`-backed observer would
have no work to watch — the same reasoning that left the executor's ledger sink empty. Every in-flight entry a
pass finds today is reported as `no-observer` rather than silently ignored, so the gap is visible.

Scheduling is not here either. #3070 ruled the host is an interval job; this is that job's body, and the
`StartInterval` is the operator's.

Eleven mutations reddened named tests. Six on the first cut: persisting after the advance instead of before,
treating overdue as dead, obeying an answer outside the closed set, polling a handle-less entry, letting one
unreadable record abort the pass, and letting an observer throw kill the run's pass. Five more after review:
removing the failed-halt, auto-answering a confirm, removing the no-progress break, moving `store.list()` back
outside its `try`, and dropping the halt from the rendered line.

Two of those five were GREEN before the review — the human-confirm hand-back had no test at all, and the
no-progress break was undefended. The hand-back is the safety property #3070's ruling rests on.
