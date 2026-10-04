---
bornAs: x7bm6nd
kind: story
size: 2
status: open
scope: ["we:skills-src/conveyor/build-dispatch-daemon.mjs", "we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs"]
dateOpened: "2026-10-02"
preparedDate: "2026-10-03"
preparedAgainstSha: "eb0677e86b2a5a17c060b7f6c6566e990bfaad83"
tags: []
---

# build-dispatch-daemon: a non-object rejection must not crash the tick

Follow-up from the #3215 advisory (2026-10-02). The failure boundary in `we:skills-src/conveyor/build-dispatch-daemon.mjs:221-225` unconditionally assigns `error.timings`. A primitive or nullish rejection therefore replaces the original failure with a TypeError and loses the timing snapshot. Preserve the original reason and timings while still rejecting the failed tick.

## Design

Normalize non-object rejection reasons at the existing `runBuildDispatchTick` catch boundary in `we:skills-src/conveyor/build-dispatch-daemon.mjs`. For null or a value whose type is neither object nor function, create `new Error(String(reason), { cause: reason })`, attach the timer snapshot, and throw that wrapper. The explicit null check is necessary because `typeof null` is object. Functions can already carry properties and should retain the existing behavior.

Keep ordinary object/Error rejections unchanged by identity, attaching timings as today; this preserves stack, child-process diagnostic fields, and callers' existing error handling. The wrapper message exposes the primitive reason to the existing `childFailure` formatter in `we:scripts/lib/child-failure.mjs`, while `cause` preserves its exact value, including undefined. Do not swallow the rejection or return a successful tick report.

The timer already records failed synchronous and asynchronous effects in `we:scripts/lib/phase-timer.mjs`; no timer or loop implementation change is needed. The existing error reporter in `we:skills-src/conveyor/build-dispatch-daemon.mjs:1495-1499` can consume the resulting message and timings without changing its output contract.

## MVP

1. Add primitive/nullish normalization in the existing catch in `we:skills-src/conveyor/build-dispatch-daemon.mjs`.
2. Add a focused `non-object rejection` suite in the existing `we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs`, using injected effects and a deterministic phase timer.
3. Keep the declared two-file implementation/test scope. No dispatch policy, retries, leases, claims, or public API changes are needed.

## Done when

- Must reject a failed tick with the original primitive reason available as its message and exact `cause`, plus a timing snapshot containing the failed effect.
- Must preserve ordinary Error identity, stack, and diagnostic fields; successful ticks retain their existing behavior.
- Must allow the existing daemon loop to report the failure and execute a subsequent tick, without converting the failure into success.
- Executable regression command, run from the WE repository root after adding the named suite (strip the repository prefix for the shell):

```bash
test_path=we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs
npx vitest run "${test_path#we:}" -t 'non-object rejection'
```

## Test plan

In `we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs`:

- Parameterize asynchronous `planTick` rejection over a nonempty string, empty string, null, undefined, false, zero, bigint, and symbol. Assert an Error wrapper, `message === String(reason)`, an own `cause` equal to the input, and the failed `planTick` phase with one call.
- Exercise a synchronous effect throw as well. Use `createPhaseTimer` from `we:scripts/lib/phase-timer.mjs` with an injected clock so elapsed-time assertions are deterministic and cover a completed earlier phase as well as the failed phase.
- Reject with an ordinary Error carrying child-process fields and assert identity, stack, fields, and attached timings survive. Cover a mutable plain object and callable rejection to pin the retained behavior.
- Drive the real `runDaemonLoop` from `we:skills-src/conveyor/verify-daemon.mjs` with injected sleep, bounded ticks, and a `tickOnce` invoking the real tick boundary: first reject with a string, then return a successful empty-plan tick. Capture `onTickError`, format through the real `childFailure`, and assert the original reason, timings, and subsequent successful tick. No live dispatch or coordination-store access is required.
- Run the full existing `we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs` suite to check successful ticks and dispatch behavior remain intact.

## Proof plan

Before implementation, run the new focused suite against the unchanged source and retain its failures: the primitive cases must expose the secondary TypeError/missing timings. After implementation, rerun the same command and the full test file; retain passing output. Inspect the bounded real-loop test's captured error report to prove the original reason and failed-phase timings reach the reporting boundary and the next tick runs. Run `npm run check:standards` for delivery. These are implementation acceptance checks, not claims that this preparation has delivered the fix.

## Follow-ups

Frozen/non-extensible objects, read-only timing properties, hostile proxies, and throwing coercion hooks are outside this non-object-rejection fix. Any broader object-normalization change needs separate evidence and compatibility review. No additional prerequisite or unresolved policy choice is needed for this MVP.

## Progress

- Preparation premise check: the original card cited `we:skills-src/conveyor/build-dispatch-daemon.mjs:222` and described a non-object rejection crashing the tick. The assignment is now at `we:skills-src/conveyor/build-dispatch-daemon.mjs:224`; the enclosing function begins at line 221. The source and matching test paths still exist, so the original two-file scope remains correct and includes the matching test file.
- Corrected premise: the secondary TypeError masks the original failure and drops timings; this is not evidence that the daemon process terminates. `we:skills-src/conveyor/verify-daemon.mjs:103-116` catches tick failures, and `we:skills-src/conveyor/build-dispatch-daemon.mjs:1495-1499` labels them non-fatal and reports timings.
- Observed with a direct Node import of the real `runBuildDispatchTick` and an injected asynchronous `planTick`: string, null, and undefined each produced a TypeError at the timing assignment with no timings. An ordinary Error retained identity and received `timings.phases.planTick.calls === 1`. This confirms the goal remains undelivered; the correction narrows the claimed failure mode without changing the goal.
- Source evidence: `we:scripts/lib/phase-timer.mjs` records asynchronous failures via `finally` and synchronous failures via its catch before rethrowing. The fault is the daemon's attachment boundary, not missing measurement. Preparation edits only this card; stamping and delivery checks remain owned by the runner.
