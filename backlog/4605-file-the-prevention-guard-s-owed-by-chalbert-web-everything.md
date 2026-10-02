---
bornAs: x2oe5e3
kind: story
size: 3
status: open
scope: ["we:scripts/conveyor/health-file-request.mjs", "we:scripts/conveyor/__tests__/health-file-request.test.mjs"]
dateOpened: "2026-09-30"
preparedDate: "2026-10-02"
preparedAgainstSha: "2252451f641990568d13fe0ed9bd9f1e179afd48"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3088's independent review

Filed mechanically by the unattended review loop (#2749) — every finding below reduced chalbert/web-everything#3088's review (reviewed head `ae8cc8d76acd0439da32d7abd118baa666ef97f5`) to prevention-outstanding by naming a guard neither captured nor filed:

1. `we:scripts/conveyor/health-file-request.mjs:284` — Add a deterministic race test that drives two full lock cycles inside `afterObserve`. Alternatively, keep gen names never-reusable by pruning only gens ≤ myGen-K, or by keeping a persistent monotonic counter file.
2. `we:scripts/conveyor/__tests__/health-file-request.test.mjs:351` — Nest the second reclaimer inside the first's `afterObserve` or body, so occupancy can genuinely exceed 1. Or spawn real subprocesses, as the existing 'neither starved' test does.
3. `we:scripts/conveyor/health-file-request.mjs:299` — Keep the last N (at least 2) generations, or never reuse a name by making the generation number come from a persisted monotonic counter. Add a deterministic test that runs two full cycles inside the afterObserve hook and asserts the stale waiter is refused.
4. `we:scripts/conveyor/health-file-request.mjs:273` — Document the legacy shim as one-shot best-effort, or drop it. Alternatively, gate rollout so no old-scheme processes run concurrently with the new code.
5. `we:scripts/conveyor/health-file-request.mjs:297` — Add a deterministic regression gate that pauses a waiter after observation, advances through two successors, prunes the pending creation target, and asserts that the waiter cannot enter while the newest successor holds the lock.
6. `we:scripts/conveyor/health-file-request.mjs:280` — A concurrency fuzz test for `withLedgerLock` that simulates process scheduling delays (e.g., using `afterObserve` to advance the lock by two generations and prune the intermediate one) to verify mutual exclusion under arbitrary interleaving.

## Progress

- Original premise/scope: six review findings proposed delayed-observer guards, stronger overlap testing, and legacy-shim clarification in the lock implementation and its unit suite. Corrected scope remains `we:scripts/conveyor/health-file-request.mjs` paired with `we:scripts/conveyor/__tests__/health-file-request.test.mjs`; neither file moved. Findings 1/3/5/6 describe the same generation-name reuse defect, finding 2 needs an independently meaningful contention assertion, and finding 4 permits documenting the existing compatibility limitation. Opening citations now locate current operations; the quoted alternatives are historical suggestions, not validated repairs.
- Source evidence: `we:scripts/conveyor/health-file-request.mjs:278` selects the highest generation, line 280 calls the observation hook, line 284 exclusively creates the successor, and lines 297–299 prune all earlier generations. The non-reuse claim at lines 252–258 therefore does not survive multiple successors. Keeping a fixed last-N window only postpones the same failure for a longer-paused observer; a monotonic allocation counter alone also does not prove mutual exclusion.
- Observed preparation probe: seed/release generation 1; inside a one-shot observation hook complete generations 2 and 3, then mark generation 3 freshly held. Resuming the original waiter produced `hookFired: true, enteredWhileSuccessorMarkedHeld: true`. This temporary-directory probe exercises the real function but uses a held-generation fixture, not a live concurrent holder. It proves admission despite a fresh successor; the live-holder test below supplies the stronger exclusion evidence.
- `we:scripts/conveyor/__tests__/health-file-request.test.mjs:351` invokes A and B in a sequential loop, so its occupancy counter cannot demonstrate overlapping callbacks. The real subprocess case at line 294 remains useful but does not force the multi-generation schedule. The superseded-holder test at line 378 expects pruning and must change with the repair. The rename example at line 274 describes an obsolete implementation mechanism.
- `we:scripts/conveyor/health-file-request.mjs:273` observes and unlinks the bare legacy lock separately; this is best-effort cleanup, not mixed-version exclusion. The case at `we:scripts/conveyor/__tests__/health-file-request.test.mjs:393` covers only a preexisting bare lock. Latest source change remains reviewed commit `ae8cc8d76`; the goal is not already delivered. Prepared open cards #4589 and #4597 overlap the generation repair, but preparation is not delivery.

## Design

Preserve the synchronous lock API and the existing stale-lease assumption. In `we:scripts/conveyor/health-file-request.mjs`, retain all generation files instead of pruning: once a waiter has observed G, any successor that acquired G+1 leaves that exact name occupied forever. Its exclusive creation must then fail even after many intervening cycles. Replace the spread-based maximum with a reduction so growing history does not hit an argument-count limit. Keep release confined to the holder's own file and document accumulation and the requirement that cleanup occur only with every ledger user stopped and no suspended waiter. These are the same minimal repairs described in #4589/#4597; reuse them if delivered first.

Use deterministic schedules in `we:scripts/conveyor/__tests__/health-file-request.test.mjs` as the required guard, rather than claiming random fuzzing proves arbitrary interleavings. Add a live-holder case using subprocess handshakes: pause waiter A in its observation hook, advance B through successors, hold B's final callback open, then resume A. A must time out without entering while B is held. Parent-controlled signals and bounded deadlines must make the test terminate on both success and failure.

For finding 4, take the review's explicit documentation option: describe the legacy shim as best-effort cleanup of preexisting locks, not a guarantee against old-protocol processes creating or replacing the bare lock concurrently. Characterize that limitation without introducing a rollout gate or choosing a new compatibility policy. Keep the existing mtime-expiry limitation explicit.

## MVP

1. Add the multi-cycle delayed-observer regressions and live-holder exclusion test to `we:scripts/conveyor/__tests__/health-file-request.test.mjs`, demonstrating failure before repair.
2. Remove pruning and correct non-reuse and legacy comments in `we:scripts/conveyor/health-file-request.mjs`; preserve public arguments, return values, timeout behavior, and lease semantics.
3. In `we:scripts/conveyor/__tests__/health-file-request.test.mjs`, update the superseded-holder expectation for retained files, replace the sequential overlap claim with the handshake test, and remove or clearly label the obsolete rename-only example. Retain real-process progress and fresh/stale legacy coverage.
4. Add a legacy-arrival characterization in the same suite: exclusive creation of the bare legacy lock inside a generation-locked callback succeeds, demonstrating the documented compatibility boundary. Clean up the fixture in finally.

## Test plan

- Parameterize empty, released, and stale-held initial observations over 2, 3, and 8 completed successor cycles inside a one-shot hook. Mark the final generation freshly held, resume the waiter, and assert the hook fired, its callback never entered, timeout occurred, and successor contents stayed unchanged. Release the fixture and prove subsequent acquisition succeeds.
- For the live-holder case, signal that A has observed before allowing B to cycle, and signal that B is inside its final callback before resuming A. Use an exclusive busy marker and entry log, assert A reports timeout and no callback entry while B is held, then release B and prove both workers terminate and a fresh acquisition succeeds. Keep the lease longer than the complete test deadline; kill/reap children on failure. This makes overlap observable instead of mathematically impossible as in the old sequential counter.
- Verify retained successor names reject exclusive recreation after multiple cycles. Verify releasing a superseded holder changes only its own generation and leaves its successor untouched; retain callback/ledger behavior coverage in the existing suite.
- Preserve preexisting fresh/stale legacy cases and add the mixed-version limitation characterization. Its pass means the limitation is documented, not that cross-version exclusion works.
- Run the focused suite in `we:scripts/conveyor/__tests__/health-file-request.test.mjs`. No new test discovery configuration is needed.

## Proof plan

Run `npx vitest run` with the repository-relative portion of `we:scripts/conveyor/__tests__/health-file-request.test.mjs` from the WE root. First run the added regressions against the reviewed implementation and record their exclusion failures, with handshake/hook assertions satisfied. Then run the identical cases after repair and record passing counts plus the full focused-suite result. A failure to establish the schedule is a harness failure, not proof of the lock defect.

Run `npm run check:standards` during delivery. Inspect the source diff for retained names and accurate legacy documentation, and map findings 1/3/5/6 to the multi-cycle guard, finding 2 to live-holder exclusion, and finding 4 to documentation plus characterization. Reuse shared evidence from #4589/#4597 only if their delivered source and tests satisfy these exact checks. Preparation edits only this card; stamping and checks belong to the runner.

## Done when

The focused test command fails on the pre-repair source for the forced generation-reuse schedule and passes after repair. A real held callback excludes the paused waiter, progress resumes after release, historical generation names cannot be reused, and legacy limitations are accurately documented and characterized. All six findings have executable or explicit documentation coverage.

## Follow-ups

- Coordinate delivery with #4589 and #4597 to avoid duplicate repairs; neither card's preparation closes this item. #4597 separately covers stale-legacy unlink deadline handling, while #4589 includes missing-observation and cleanup-exception coverage.
- Online tombstone reclamation or a replacement lock protocol requires a separate proof of safe delayed-observer handling. Do not restore a fixed-depth retention window as an incidental optimization.
- Broader generated scheduling/fuzz coverage can extend the deterministic cases later; it is not required to establish the concrete regression here. Mixed-version safe rollout machinery remains outside this documentation-and-guard scope.
