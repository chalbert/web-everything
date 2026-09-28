---
kind: story
size: 5
priority: high
status: open
scope: ["we:skills-src/conveyor/verify-daemon.mjs", "we:scripts/conveyor/verify-dispatch.mjs", "we:scripts/readiness/heavy-admission.mjs", "we:scripts/conveyor/__tests__/verify-dispatch.test.mjs"]
dateOpened: "2026-09-28"
tags: []
---

# Verify daemon runs checks in parallel up to the heavy-admission cap

we:skills-src/conveyor/verify-daemon.mjs + we:scripts/conveyor/verify-dispatch.mjs handle ONE lane-verify request per tick, to completion, before considering the next (the file's own header: ONE REQUEST PER TICK). we:scripts/readiness/heavy-admission.mjs's own DEFAULT_ADMISSION_CAP is 2 heavy slots (+1 fast), overridable via WE_HEAVY_ADMISSION_CAP — so up to that many gate runs could safely run at once, but the dispatch pass never offers more than one. Run dispatch up to the heavy-admission cap concurrently, each gate under its own per-lane marker/lock, admitted through heavy-admission the same way a directly-invoked we:scripts/verify-lane.mjs already is.

## Scope

- **we:scripts/conveyor/verify-dispatch.mjs** — `runVerifyDispatch`'s IO-shell sweep. Its own header states the
  invariant to change: "ONE REQUEST PER TICK, HANDLED TO COMPLETION BEFORE THE NEXT IS CONSIDERED... the runner
  is a SINGLETON... this pass simply never starts a second `we:verify-lane.mjs` run until the current one's
  terminal marker is written." Replace the single in-flight assumption with up to N concurrent runs, admitted
  through heavy-admission (below) — one per distinct lane.
- **we:skills-src/conveyor/verify-daemon.mjs** — the standalone daemon that ticks `runVerifyDispatch` under its
  own keyed `we:skills-src/conveyor/runner-lock.mjs` lease. The lease itself protects "at most one live daemon
  PROCESS" — going parallel is an in-process change to how many gate runs one tick admits, not a change to what
  the lease guards (confirmed by reading the lease acquire/heartbeat call sites before changing the loop).
- **we:scripts/readiness/heavy-admission.mjs** — `DEFAULT_ADMISSION_CAP = 2` (heavy slots) `+ 1` fast slot,
  overridable via `WE_HEAVY_ADMISSION_CAP`. The daemon must request one admission slot per lane it dispatches,
  the same mechanism a directly-invoked `we:scripts/verify-lane.mjs` already goes through, so the new
  concurrency never exceeds the SAME host-wide cap other heavy commands (test:unit, check:standards, other
  lanes' own direct verify calls) already share.
- **we:scripts/conveyor/__tests__/verify-dispatch.test.mjs** — existing sweep tests, extended per the Test plan.

## Risks

- **Per-lane serialization must survive going parallel.** The only real correctness invariant is "at most one
  gate run per LANE's own `.lane-verify` marker at a time" — not "at most one gate run globally." Two DIFFERENT
  lanes running concurrently is safe by construction; two requests for the SAME lane must still serialize. Test
  plan item 3 covers this directly.
- **Per-tick module-level state must become per-run state.** `we:scripts/conveyor/verify-dispatch.mjs`'s two
  separate timeout ceilings (queue-phase vs gate-phase, keyed off the `gate execution starting` stderr marker)
  and its spawned-child tracking are written assuming one in-flight run; going concurrent means N simultaneous
  children each need their own timer/tracking state, not shared mutable state that one run's completion could
  clobber for another.
- **The host-wide heavy-admission cap is shared, not dedicated to this daemon.** Other concurrent heavy work
  (a lane's own direct `we:scripts/verify-lane.mjs` call, `test:unit`, `check:standards`) already competes for
  the same `WE_HEAVY_ADMISSION_CAP` slots — the daemon going parallel must acquire slots through that same
  mechanism rather than a second, independent concurrency counter, or the two caps could silently disagree.
- **A full-suite fallback lane (backlog/, gate-self/policy-core paths, per
  we:scripts/lib/verify-lane-gate.mjs) run concurrently with a shrunk lane is heavier than two shrunk lanes.**
  The cap bounds PROCESS COUNT, not load; this is a known, accepted limit of a count-based cap, not something
  this card needs to solve, but it should be stated rather than silently assumed away.

## Test plan (each fails before the fix)

1. `we:scripts/conveyor/__tests__/verify-dispatch.test.mjs`: given pending request markers on 2 distinct lanes
   (fake admission + fake spawn, cap ≥ 2), `runVerifyDispatch` dispatches both without waiting for the first to
   finish — a fixture proves their fake gate-start timestamps overlap, not one starting only after the other's
   terminal marker.
2. Given N+1 pending lanes and a cap of N, only N run concurrently; the (N+1)th is admitted only once a slot
   frees — proven via `we:scripts/readiness/heavy-admission.mjs`'s own slot bookkeeping, not a second counter.
3. Given two pending requests for the SAME lane, they never run concurrently even though the daemon overall is
   now parallel (the per-lane marker lock still holds).
4. One of N concurrent runs hitting `VERIFY_DISPATCH_TIMEOUT_MS` kills only its own process group; the other
   concurrent runs are unaffected and complete normally.

## Tasks

1. Read `we:skills-src/conveyor/runner-lock.mjs`'s lease semantics in full to confirm it protects one live
   daemon process, not one in-flight dispatch, before changing the tick loop.
2. Convert `we:scripts/conveyor/verify-dispatch.mjs`'s per-tick module state (queue/gate timers, spawned-child
   tracking) to per-run state, keeping the file's existing pure-core/IO-shell split.
3. Change the tick loop to admit up to `WE_HEAVY_ADMISSION_CAP` (default 2) lanes concurrently, requesting one
   admission slot per lane through `we:scripts/readiness/heavy-admission.mjs`, the same path a direct
   `we:scripts/verify-lane.mjs` invocation already uses.
4. Extend `we:scripts/conveyor/__tests__/verify-dispatch.test.mjs` per the Test plan above.
5. Gate with the `verify` operation; open with `open-pr`; run the proof plan below.

## Proof plan (live, before/after)

- **Before:** with two lanes' `.lane-verify` markers stamped `request` at roughly the same time, the daemon's
  own log shows the second lane's `gate execution starting` marker only after the first lane's terminal
  (green/red) marker is written — record the two lanes' real timestamps.
- **After:** the same two-lane scenario shows both lanes' `gate execution starting` markers within the same
  tick (overlapping wall-clock), and both lanes reach a terminal marker sooner in total than the serial
  baseline — record the real before/after timestamps from the daemon's own log as the live evidence.
