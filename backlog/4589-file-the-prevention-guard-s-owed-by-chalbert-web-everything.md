---
bornAs: x1a9v1e
kind: story
size: 3
status: open
scope: ["we:scripts/conveyor/health-file-request.mjs", "we:scripts/conveyor/__tests__/health-file-request.test.mjs"]
dateOpened: "2026-09-30"
preparedDate: "2026-10-02"
preparedAgainstSha: "cd03310da7b69724db9196d43390d9fd9ef591d9"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3088's independent review

Filed mechanically by the unattended review loop (#2749) — every finding below reduced chalbert/web-everything#3088's review (reviewed head `ae8cc8d76acd0439da32d7abd118baa666ef97f5`) to prevention-outstanding by naming a guard neither captured nor filed:

1. `we:scripts/conveyor/health-file-request.mjs:281` — Add a multi-generation interleaving test using the `afterObserve` seam. Prune only tombstones at least two generations old, or treat a vanished observed gen (`!obs` with `cur>0`) as 're-observe' rather than 'takeable'. File as a backlog item for a lock-protocol model-check or property test.
2. `we:scripts/conveyor/health-file-request.mjs` — Add a model-style test that uses the afterObserve seam to run N>=2 full lock cycles between observe and take. Alternatively, prune only gens <= myGen-2, or never reuse names by keeping a monotonic high-water marker file.
3. `we:scripts/conveyor/health-file-request.mjs` — Document, or gate at deploy time, that only one health-daemon version runs during the cutover, and add a test for an old-scheme wx lock appearing while a gen lock is held. Alternatively, have the new scheme also take the legacy name exclusively.
4. `we:scripts/conveyor/health-file-request.mjs` — Move the prune inside the try, or wrap it in try/catch. A review lens on 'work between acquire and try/finally' would catch this class.
5. `we:scripts/conveyor/health-file-request.mjs:297` — Add a deterministic regression test using afterObserve to complete one successor acquisition and resume the original waiter inside the next successor's critical section; assert that the original waiter cannot enter. Require this test in the normal test gate.
6. `we:scripts/conveyor/health-file-request.mjs:280` — A concurrency stress test simulating multi-generation delays (e.g., a waiter pausing in `afterObserve` while the lock cycles multiple times) would explicitly catch ABA regressions.

## Progress

- Preparation research: the original scope named the lock implementation and its existing unit suite; those paths remain correct. The original six findings mixed four versions of the same delayed-observer regression, legacy cutover compatibility, and a cleanup exception hazard. Corrected scope is the same two files, with one bounded interleaving suite covering findings 1/2/5/6, an explicit legacy compatibility characterization for finding 3, and removal of unsafe pruning addressing finding 4. No new daemon deployment mechanism is implied.
- Source evidence: `we:scripts/conveyor/health-file-request.mjs:278` selects the highest generation; `we:scripts/conveyor/health-file-request.mjs:280` invokes the observation seam; `we:scripts/conveyor/health-file-request.mjs:281` accepts missing observations; `we:scripts/conveyor/health-file-request.mjs:297` enumerates/prunes generations before the release-protected try. The opening citations now point at those current operations rather than historical line positions.
- `we:scripts/conveyor/__tests__/health-file-request.test.mjs:339` covers one successor, and its tombstone case at line 367 checks only immediate release. Its superseded-holder case at line 373 explicitly expects pruning. Its legacy case at line 393 covers a preexisting bare lock, not an old writer arriving during a generation critical section. The earlier atomic-rename example at line 274 tests filesystem behavior rather than the current protocol and must stop claiming that the implementation uses rename reclamation.
- Observed reproduction against the current implementation: seed/release generation 1; in a one-shot `afterObserve`, complete generations 2 and 3, mark generation 3 freshly held, then resume the original waiter. A temporary-directory Node probe returned `hookFired: true, enteredWhileSuccessorHeld: true`. This establishes a remaining defect, not an already-delivered guard. Latest implementation history is `ae8cc8d76` (#4381), the reviewed delivery itself.
- Narrowing the proposed fixes: retaining only two generations cannot protect arbitrarily delayed observers; rejecting only a missing observation does not protect an already-read released observation. Neither suggestion alone closes the demonstrated schedule. #4597 duplicates the generation guard and separately owns the stale-legacy unlink/deadline problem; coordinate that shared scope during delivery.

## Design

Preserve the existing synchronous `withLedgerLock` interface, fd-consistent observation, exclusive generation creation, timeout behavior, and mtime lease assumption. Make generation names non-reusable by retaining every generation tombstone: remove acquisition-time pruning, and re-observe when a nonzero listed generation is missing instead of treating it as takeable. The invariant is that an observer of generation G can never recreate G+1 after a successor has used that name. Fixed-depth retention cannot establish that invariant for unbounded observation delays.

Put successful acquisition directly under the existing try/finally release protection. Removing the prune enumeration also removes the particular throwing filesystem operation between acquisition and try. Update the implementation comments to describe retention honestly, including accumulating files and the requirement that any manual cleanup happen only with all ledger users stopped and no suspended waiters.

For finding 3, use the review's documentation-and-test option: document that generation locks do not exclude an old writer that creates the bare lock after the new writer checked it. Cutover requires stopping all old-protocol ledger writers (daemon and landing processes) before starting new ones. Characterize that limitation in a test; do not claim rolling mixed-version safety or silently add a second lock protocol. This is an existing compatibility boundary, not a new deployment policy.

## MVP

1. In `we:scripts/conveyor/__tests__/health-file-request.test.mjs`, add deterministic delayed-observer cases using the real lock function and the existing seam, with one-shot hooks and temporary directories. Cover initially empty, released, and stale-held observations across multiple successor generations.
2. In `we:scripts/conveyor/health-file-request.mjs`, retain tombstones, refuse missing nonzero observations, remove pre-try pruning, and correct protocol/cutover documentation.
3. Update the existing superseded-holder test to assert that release touches only its retained generation and leaves the successor unchanged. Replace the obsolete rename-mechanism claim with assertions against the actual lock API. Add legacy-arrival characterization and callback-exception release coverage in the same test file.

No kernel-lock replacement, heartbeat redesign, automatic tombstone garbage collection, daemon deployment gate, or changes to ledger planning are required. Source and matching test are both already listed in scope.

## Test plan

- Parameterize bounded model-style schedules over 2, 3, and 8 completed cycles between observation and take. Use actual successor acquisitions for the cycle history; leave a fresh final held generation as the contention fixture. Assert the hook fired, the delayed callback never entered, the timeout occurred before lease expiry, and the held successor bytes did not change. Release the final fixture and assert a fresh call makes progress. The empty-directory case must also prevent generation 1 reuse.
- Include the short ABA schedule: complete one successor, advance into the next generation, and resume the old observation while that generation is held. Check the callback count, not just the presence of lock files. Verify every historical successor name still refuses exclusive recreation.
- Exercise the missing-listed-generation branch with an isolated filesystem mock between directory listing and observation. Assert no acquisition from the vanished observation and successful re-observation; scope/reset the mock so other tests use the real filesystem.
- While a generation callback is active, emulate an old writer's exclusive creation of the bare lock. Assert that creation succeeds today and remains a documented unsupported overlap; clean it up in finally. Retain the fresh/stale preexisting-legacy tests. This characterization is not evidence of cross-version exclusion.
- Throw from the callback, assert its generation is released, and prove immediate subsequent acquisition succeeds. Retain the existing real two-process contention test and ledger claim/patch tests. Keep lease expiry well beyond intentional callback duration.
- Run the scoped Vitest suite in `we:scripts/conveyor/__tests__/health-file-request.test.mjs`; it is an existing normally discovered suite, so no separate opt-in gate or new test configuration is needed.

## Proof plan

Before implementation, run the new multi-generation tests against the current source and record failure at the callback-exclusion assertion, with the hook-fired assertion passing. After implementation, rerun the same tests and the full scoped suite, recording passing counts and the retained real-process contention result. The deterministic before/after schedule is the required executable proof; random stress alone is insufficient.

From the WE repository root, run Vitest with the repository-relative form of `we:scripts/conveyor/__tests__/health-file-request.test.mjs`, then `npm run check:standards`. Inspect the diff for removal of pre-try pruning and corrections to the stale rename description. Record the legacy characterization separately so a green test is never presented as mixed-version compatibility. Preparation itself changes only this card; the runner owns stamping and checks.

## Done when

The multi-generation regression fails on the reviewed implementation and passes with the retained-name protocol; callback failures release ownership; the existing scoped suite passes; and legacy cutover limitations are explicit beside the implementation and covered by a characterization test. All six review findings map to the guards or corrected premises above.

## Follow-ups

- Coordinate with #4597 before implementation so its duplicated generation tests/fix are reused rather than implemented twice. Its stale-legacy unlink timeout and broader CAS review checklist remain separate obligations.
- Tombstone retention trades bounded disk usage for a simple non-reuse invariant. Online reclamation requires its own proof that no delayed observer can reuse a name; do not reintroduce fixed-depth pruning as an incidental optimization.
- A broader generated/property-based lock model can extend the bounded deterministic schedules later. It must cover observation delays, release, takeover, and cleanup; it is not a prerequisite for these concrete regression guards.
