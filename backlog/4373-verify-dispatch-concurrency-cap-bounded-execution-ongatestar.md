---
bornAs: x74f2cl
kind: story
size: 3
status: active
scope: ["we:scripts/conveyor/verify-dispatch.mjs", "we:scripts/conveyor/__tests__/verify-dispatch.test.mjs", "we:scripts/verify-lane.mjs", "we:scripts/readiness/heavy-admission.mjs"]
dateOpened: "2026-09-28"
dateStarted: "2026-09-30"
preparedDate: "2026-09-30"
preparedAgainstSha: "2ee6ce2d65e030fc51ba7a9d6e3d6ad2c961d050"
tags: []
---

# Verify-dispatch concurrency: cap-bounded execution + onGateStarted wiring lack direct tests

#4360 made we:scripts/conveyor/verify-dispatch.mjs#runVerifyDispatch offer every pending lane's gate to the heavy-admission semaphore at once instead of one at a time. Real concurrent gate execution is bounded only by each spawned we:scripts/verify-lane.mjs child's own acquireSlotBlocking wait against we:scripts/readiness/heavy-admission.mjs's cap, which fails open on a queuing timeout (documented, pre-existing) — so a backlog larger than the cap can, in principle, run more gates concurrently than the cap names. Two independent converge review rounds (#4360) raised this consistently but classified it as a carve-out (not release-blocking), since the daemon-side fan-out change is deliberate per #4360's own corrected plan and adding a second admission chokepoint in the daemon would be wrong. What is missing is test coverage for the properties that keep it safe: (1) a real multi-lane integration test (N pending lanes greater than a small real admission cap) asserting peak held slots never exceeds the cap while all N lanes still eventually reach a terminal marker; (2) a test that runVerifyDispatch's OWN onGateStarted wiring (not just spawnGateBounded's hook in isolation) actually logs the gate-started line for a real dispatched lane — the existing concurrent-dispatch tests use a fake spawnGate that ignores it; (3) a code-level check (or a repeated code comment is not enough) that we:scripts/conveyor/verify-dispatch.mjs never itself calls acquireSlotBlocking, so a future edit cannot accidentally add a second admission chokepoint. Edge cases the new tests must cover: N pending lanes where N is 2x and 3x the real cap; a lane whose child fails open (proceeds unslotted) still gets counted correctly in dispatched/failures; the onGateStarted log line's timestamp actually reflects the real per-lane gate start, not the dispatch/offer time.

## Premise check (2026-09-30, against `main` @ 2ee6ce2d)

Holds — nothing already covers it. we:scripts/conveyor/__tests__/verify-dispatch.test.mjs has (a) `spawnGateBounded` `onGateStarted` tests in isolation (l.279-301), (b) `runVerifyDispatch` concurrency tests that use a FAKE `spawnGate` which ignores `onGateStarted` (l.375-432), (c) one real admission-contention test with ONE lane at cap 1 (l.303-372). No test runs N real lanes against a real cap, none drives `runVerifyDispatch`'s own `onGateStarted` closure (we:scripts/conveyor/verify-dispatch.mjs:431), and nothing forbids we:scripts/conveyor/verify-dispatch.mjs from calling `acquireSlotBlocking` (only prose comments at we:scripts/conveyor/verify-dispatch.mjs:30 and we:scripts/verify-lane.mjs:335). One card detail is stale: it says the queue "fails open on a queuing timeout", but we:scripts/verify-lane.mjs:346 passes `timeoutMs`, a parameter `acquireSlotBlocking` (we:scripts/readiness/heavy-admission.mjs:898) no longer has; the only real fail-open exits today are the 120-minute hard ceiling (we:scripts/readiness/heavy-admission.mjs:925) and `WE_HEAVY_ADMISSION=off`. The tests below therefore use the `off` switch as the deterministic "proceeds unslotted" case.

## Design

Tests only — no behavior change to the dispatch loop.

- **Cap test (real).** In we:scripts/conveyor/__tests__/verify-dispatch.test.mjs, build N pending lanes with `makeLane` + `we:scripts/verify-lane.mjs request --gate="sleep 1"` (an arbitrary command is accepted as the gate, as the existing `--gate=true` tests show) — but the gate is a tiny node script (not `sleep`) that appends `start <lane> <ms>` / `end <lane> <ms>` lines to a shared log file and sleeps ≥3s, so real gate concurrency is measured INDEPENDENTLY of the semaphore: `heldSlots` cannot exceed `cap` by construction (it only scans `cap` slot files), so it must not be the assertion. Compute peak overlap from the start/end intervals. The child inherits `process.env`, so the test sets `LANE_POOL_ROOT`, `WE_HEAVY_ADMISSION_CAP=2` and deletes `WE_HEAVY_ADMISSION` on `process.env` and restores all of it in a `finally` (the suite runs on vitest threads; `CI`/`WE_HEAVY_ADMISSION_HELD` only matter for the `we:scripts/readiness/heavy-admission.mjs run` wrapper, not `verify-lane`'s own acquire). Assert peak overlap ≤ 2 AND ≥ 2 (proves overlap happened, so the bound is not vacuous; ≥3s gates because waiters poll every 2s and only the oldest may try), every lane's marker is terminal `green` via `we:scripts/verify-lane.mjs check`, and `dispatched.length === N`. Run for N = 4 and 6 with cap 2; expect ~10-20s (three waves plus poll latency), so give each test an explicit 60s timeout.
- **Wiring test.** Call `runVerifyDispatch` with a `spawnGate` wrapper that forwards to the real `spawnGateBounded` and captures the options it received; assert they include a function `onGateStarted`. Separately drive one real lane (`--gate=true`) through the real `spawnGateBounded` while spying `process.stderr.write` (the module's `log` writes there) and assert exactly one `▶ gate started for flagtest/lane-1 @ <sha8> — <ISO>` line appears. For the timestamp edge: hold the single cap-1 slot with a real `we:scripts/readiness/heavy-admission.mjs run … sleep 2` holder (reuse the l.303-372 pattern), record `offerAt = Date.now()`, and assert the logged ISO time is at least `offerAt + (remaining hold − 300ms)`, i.e. it reflects gate start, not offer time.
- **Unslotted counting (weak preservation).** Same real-lane setup with `WE_HEAVY_ADMISSION=off` (child takes the `disabled` branch, proceeds unslotted): assert the lane lands in `dispatched` with no `failures` entry and a green marker. This is NOT the `timedOut`/`ceilingHit` fail-open path — that is unreachable from `we:scripts/verify-lane.mjs` today because it passes no `ceilingMs` (see Follow-ups); the test is labelled accordingly and the card's "child fails open" edge is covered only to this extent.
- **No second chokepoint (static).** A test reading we:scripts/conveyor/verify-dispatch.mjs source, stripping comments with a small string-aware scanner (the file's template strings contain `//` and `…`), and asserting the identifiers `acquireSlotBlocking` and `tryAcquireSlot` never appear in code, only in comments. A source scan is the intended mechanism because the property is "a future edit must not add a call"; there is no runtime hook for that. It bans only those two identifiers (the file legitimately imports `resolveCeilingMs`); aliased/dynamic access is a known limit, stated in the test's comment.

## MVP

Musts: the four test groups above (cap at 2×/3×, `onGateStarted` wiring + timestamp, fail-open counting, static no-chokepoint guard), plus the runnable `Done when` command below. Deliberately OUT: any change to `runVerifyDispatch`, we:scripts/verify-lane.mjs or we:scripts/readiness/heavy-admission.mjs; making the 120m hard ceiling configurable; removing the dead `timeoutMs` argument at we:scripts/verify-lane.mjs:346.

## Test plan

- `#4373 peak concurrent gates ≤ cap with 2×cap (4) pending lanes` (preservation — passes today) — asserts independently measured peak gate overlap is in [2, 2] and all 4 markers green. Mutation proofs: running with `WE_HEAVY_ADMISSION=off` makes all 4 gates overlap (peak 4) and fails the ≤2 half; forcing serial dispatch (await between lanes) gives peak 1 and fails the ≥2 half.
- `#4373 same with 3×cap (6 lanes)` (preservation — same mutation proofs, peak 6 / peak 1) — catches waiter starvation or fail-open under a deeper queue.
- `runVerifyDispatch passes its own onGateStarted to spawnGate and logs one gate-started line per real lane` — RED if the closure at we:scripts/conveyor/verify-dispatch.mjs:431 were dropped or renamed (the fake-`spawnGate` tests today would still pass).
- `gate-started timestamp reflects gate start, not offer time` — RED if the log used dispatch-time `new Date()`; asserted against a real cap-1 holder.
- `#4373 an unslotted (admission off) lane is still counted in dispatched, not failures` (weak preservation — passes today; guards only against a future change that reads the child's admission outcome).
- `dispatch source code never references acquireSlotBlocking or tryAcquireSlot` (capability) — RED when a mutation adds the call (verified by temporarily inserting one in the lane, expecting failure, then reverting).

## Proof plan

Before/after on the real code, not only green tests: (1) run the new file with a mutation that adds an `acquireSlotBlocking(...)` call to we:scripts/conveyor/verify-dispatch.mjs and another that drops the `onGateStarted` line — capture the two RED failures; revert and capture GREEN (`npx vitest run` on we:scripts/conveyor/__tests__/verify-dispatch.test.mjs). (2) Log the independently measured peak gate overlap from the test (`console.info`) for N=4 and N=6, plus the `WE_HEAVY_ADMISSION=off` mutation's peak (4 / 6), and paste both into the PR body as before/after evidence the cap held. Note most new tests are preservation tests that pass on today's code — the RED evidence is the mutation runs, not a pre-item failure.

## Follow-ups

- Wire we:scripts/verify-lane.mjs to pass `ceilingMs` (or drop its dead `timeoutMs`) so the fail-open bound is configurable and tests can reach the timeout path.
- A live dispatch-sweep probe reporting peak concurrent gates per tick (observability, beyond a test).

## Done when

1. **Executable** — in we:scripts/conveyor/__tests__/verify-dispatch.test.mjs, `grep -c '#4373'` on that file must be ≥ 6, and `npx vitest run -t "#4373"` on it must pass — the grep half fails before this item lands (no `#4373` tests exist) and the vitest half passes after; the new tests carry `#4373` in their names.
