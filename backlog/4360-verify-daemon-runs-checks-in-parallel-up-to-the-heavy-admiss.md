---
bornAs: xuyqu42
kind: story
size: 5
priority: high
tier: pinned
rank: x
status: open
scope: ["we:skills-src/conveyor/verify-daemon.mjs", "we:scripts/conveyor/verify-dispatch.mjs", "we:scripts/readiness/heavy-admission.mjs", "we:scripts/conveyor/__tests__/verify-dispatch.test.mjs"]
dateOpened: "2026-09-28"
preparedDate: "2026-09-28"
preparedAgainstSha: "d0ca633fdd77999f8e9ac61e0ee330544ab494eb"
tags: []
---

# Verify daemon runs checks in parallel up to the heavy-admission cap

we:skills-src/conveyor/verify-daemon.mjs + we:scripts/conveyor/verify-dispatch.mjs handle ONE lane-verify request per tick, to completion, before considering the next (the file's own header: ONE REQUEST PER TICK). we:scripts/readiness/heavy-admission.mjs's own DEFAULT_ADMISSION_CAP is 2 heavy slots (+1 fast), overridable via WE_HEAVY_ADMISSION_CAP — so up to that many gate runs could safely run at once, but the dispatch pass never offers more than one. Run dispatch up to the heavy-admission cap concurrently, each gate under its own per-lane marker/lock, admitted through heavy-admission the same way a directly-invoked we:scripts/verify-lane.mjs already is.

## Codex review correction (folded 2026-09-28)

A read-only Codex plan review (`node we:scripts/codex-direct-task.mjs --review`) read the actual mechanism and
found the original version of this card (below, superseded) invented machinery that does not exist and missed
machinery that already does. Corrected understanding, confirmed by reading the live files:

- **`we:scripts/conveyor/verify-dispatch.mjs#runVerifyDispatch`'s loop `AWAIT`s each lane's `spawnGateBounded`
  call before starting the next one** — this, not a missing admission mechanism, is the actual serialization.
  The fix is to stop awaiting between lanes, not to add new concurrency-control code.
- **Admission is already acquired inside the SPAWNED CHILD**, not the daemon. `we:scripts/verify-lane.mjs`'s own
  `acquireSlotBlocking` call (before it runs the gate) is the ONLY admission chokepoint in this whole path. The
  daemon must NOT also acquire a slot itself before spawning — that would double-acquire (two slots per lane) or
  stall a child behind its own parent's held slot. Letting the loop dispatch several children without awaiting
  between them, and letting EACH child's own existing `acquireSlotBlocking` call queue on the SAME semaphore, is
  sufficient to bound real concurrent gate execution at the cap — no new admission logic is needed here at all.
- **There is no per-lane execution lock to "preserve."** `we:scripts/verify-lane.mjs` writes a `running` marker
  and compares SHAs at finish; nothing stops two concurrent invocations against the same lane's marker. The real
  invariant is simpler and already holds structurally: `runVerifyDispatch` walks each lane at most once per
  sweep, so a single sweep never dispatches the same lane twice — there is no lock to add, just an invariant to
  keep true when the loop stops serializing.
- **`spawnGateBounded`'s timers/buffers are already per-call closure state**, not module-level — confirmed by
  reading the function (`child`, `stderrTail`, `markerSeen`, `timedOutPhase`, `timer` are all declared inside
  the function body). Going concurrent needs no state-scoping refactor here.
- **The daemon's log does not currently forward or timestamp per-lane gate-start events** — `spawnGateBounded`
  only watches the child's stderr internally to detect its own `GATE_STARTED_MARKER`; nothing writes that to the
  daemon's log or anywhere else observable. The live proof plan needs an explicit, small addition (log the
  marker-seen moment per lane) rather than assuming the evidence already exists.

The Scope/Risks/Test plan/Tasks/Proof plan below are rewritten against this corrected understanding.

## Scope

- **we:scripts/conveyor/verify-dispatch.mjs** — `runVerifyDispatch`'s per-tick loop (`for (const lane of
  laneIndicesIn(poolDir)) { ... await spawnGateBounded(...) ... }`). Change it to fire each pending lane's
  `spawnGateBounded` call without awaiting the previous one, collecting all the promises and settling them
  together (e.g. `Promise.allSettled`) so one lane's failure/timeout can never sink the others' bookkeeping.
- **we:scripts/verify-lane.mjs** — read-only for this card: confirm (and guard against regressing) that its own
  `acquireSlotBlocking` call remains the sole admission chokepoint; the daemon-side change must not add a second
  one.
- **we:scripts/readiness/heavy-admission.mjs** — read-only: `DEFAULT_ADMISSION_CAP = 2` (heavy) `+ 1` fast slot,
  overridable via `WE_HEAVY_ADMISSION_CAP`, fails open at its own ceiling. This card does not change this file;
  it changes whether the daemon offers it more than one candidate at a time.
- **we:scripts/conveyor/__tests__/verify-dispatch.test.mjs** — existing sweep tests, extended per the Test plan.

## Risks

- **A same-lane double-dispatch is prevented by "one pass per lane per sweep," not a lock — this must stay true
  after the change.** If a future edit ever lets one sweep revisit a lane (e.g. a retry path), a lock genuinely
  would be needed then; today it is not, and this card must not invent one that has nothing to guard.
- **Failure isolation is not free — it must be `Promise.allSettled`, not `Promise.all`.** If the loop simply
  fires all the promises and `await`s them together with `Promise.all`, ONE lane's `spawnGateBounded` rejection
  (a timeout or non-zero exit) would reject the whole batch and lose the other lanes' `dispatched`/`failures`
  bookkeeping. This is the one real correctness risk in the fix itself.
- **The host-wide heavy-admission cap is shared, not dedicated to this daemon.** Other concurrent heavy work (a
  lane's own direct `we:scripts/verify-lane.mjs` call, `test:unit`, `check:standards`) already competes for the
  same slots — going parallel here does not raise the cap, it only lets this daemon legitimately offer more
  candidates to the existing semaphore at once, which is the whole point.
- **A full-suite fallback lane run concurrently with a shrunk lane is heavier than two shrunk lanes.** The cap
  bounds admitted PROCESS COUNT, not load — a known, accepted, pre-existing limit of the count-based cap
  ([#heavy-command-admission-queue](../../docs/agent/platform-decisions.md#heavy-command-admission-queue)),
  not something this card needs to solve.
- **`we:skills-src/conveyor/verify-daemon.mjs`'s own runner-lock lease is unaffected and irrelevant here** — it
  protects "one live daemon process," a different property from how many gates one process's tick admits.

## Test plan (each fails before the fix)

1. `we:scripts/conveyor/__tests__/verify-dispatch.test.mjs`: given pending request markers on 2 distinct lanes
   (a fake `spawnGateBounded` whose promise resolves only when told to), `runVerifyDispatch` calls it for BOTH
   lanes before either's promise resolves — proving the loop no longer awaits between lanes.
2. One lane's fake `spawnGateBounded` rejecting (simulated timeout or non-zero exit) does not prevent the other
   lane's dispatch from being recorded in `dispatched`/`failures` — proving `Promise.allSettled` semantics, not
   `Promise.all`.
3. Within one sweep, a lane already visited is never dispatched a second time (the existing "one pass per lane"
   invariant, unit-tested directly against `laneIndicesIn`/the loop, not against an invented lock).
4. A live proof (not a unit test, see Proof plan) confirms two REAL lanes' gates run with overlapping wall-clock,
   using the newly-added per-lane gate-start log line.

## Tasks

1. Change `we:scripts/conveyor/verify-dispatch.mjs#runVerifyDispatch`'s loop to collect each pending lane's
   `spawnGateBounded(...)` promise without awaiting it before moving to the next lane, then `Promise.allSettled`
   the collected promises, preserving each lane's own `dispatched`/`failures` entry.
2. Add a code comment (and, ideally, a test) at the admission call site in `we:scripts/verify-lane.mjs` stating
   explicitly that it is the sole admission chokepoint for this path, so a future daemon-side change does not
   accidentally add a second one.
3. Add a small log line (daemon-side, or read from each lane's own marker) recording when each lane's gate
   actually started, so the live proof below has real timestamps to compare rather than an assumption.
4. Extend `we:scripts/conveyor/__tests__/verify-dispatch.test.mjs` per the Test plan above.
5. Gate with the `verify` operation; open with `open-pr`; run the proof plan below.

## Proof plan (live, before/after)

- **Before:** with two lanes' `.lane-verify` markers stamped `request` at the same time, running one daemon
  tick shows the second lane's gate starting only after the first lane's gate has already reached a terminal
  marker — record the two lanes' real timestamps.
- **After:** the same two-lane scenario, using the newly-added gate-start log line, shows both lanes' gates
  starting with overlapping wall-clock, and both lanes reaching a terminal marker sooner in total than the
  serial baseline — record the real before/after timestamps as the live evidence.

---
## Superseded original plan (kept for the record — do not implement as written)

The Scope/Risks/Test plan/Tasks/Proof plan that originally shipped with this card assumed the daemon itself
needed to acquire heavy-admission slots and needed to convert module-level timer state to per-run state. Both
assumptions were wrong on a direct read of the code (see the Codex review correction above) — the daemon must
NOT acquire its own slot (the child already does), and `spawnGateBounded`'s state is already per-call. Left
here only so the correction's own diff is legible; the sections above are the ones to implement.

