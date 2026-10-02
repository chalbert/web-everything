---
bornAs: xi9q81z
kind: story
size: 3
status: open
scope: ["we:scripts/conveyor/health-file-request.mjs", "we:scripts/conveyor/__tests__/health-file-request.test.mjs"]
dateOpened: "2026-09-30"
preparedDate: "2026-10-02"
preparedAgainstSha: "ac2e9dc86bcaf9c5f27bcc5a2091e11de598e967"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3088's independent review

Filed mechanically by the unattended review loop (#2749), from review of head `ae8cc8d76acd0439da32d7abd118baa666ef97f5`. Capture and deliver the missing multi-generation exclusion, failed legacy-unlink timeout, and structural CAS prevention guards. Findings 1 and 2 share one regression family; finding 4 supplies its review checklist.

## Progress

- Preparation research: the old premise cited acquisition/pruning/legacy handling at lines 301, 297, 282, and 279 of we:scripts/conveyor/health-file-request.mjs, and requested guards without an executable acceptance criterion. The original scope was that source plus we:scripts/conveyor/__tests__/health-file-request.test.mjs.
- Corrected premise: the implementation has not moved. Current acquisition is at we:scripts/conveyor/health-file-request.mjs:283, pruning at we:scripts/conveyor/health-file-request.mjs:297, and stale legacy unlink at we:scripts/conveyor/health-file-request.mjs:275. Pruning can delete a delayed observer's intended successor filename; failed unlink unconditionally continues before the deadline at we:scripts/conveyor/health-file-request.mjs:294. These are still live defects, not merely missing tests.
- Source evidence: we:scripts/conveyor/__tests__/health-file-request.test.mjs:330 covers one successor, and its two-reclaimer case runs the reclaimers sequentially. The tombstone case at we:scripts/conveyor/__tests__/health-file-request.test.mjs:372 checks only immediate release; the superseded-holder case at we:scripts/conveyor/__tests__/health-file-request.test.mjs:379 explicitly expects pruning. The rename-only test at we:scripts/conveyor/__tests__/health-file-request.test.mjs:273 describes an obsolete implementation and does not test the current protocol.
- Observed probe: imported the actual lock function into a temporary-directory Node harness, seeded released generation 1, and used its one-shot `afterObserve` hook to complete acquisitions 2 and 3, then mark 3 freshly held. Resuming the original observer produced `staleObserverEntered: true`, generation 3 still `held:424242`, and recreated generation 2 `released`. This reproduces stale admission against a held successor; it does not itself prove real-process overlap. Temporary files were removed. The unlink timeout defect is source-observed here; its fault-injection regression remains to be implemented.
- Corrected scope remains the same two files: implement the guards and the minimal repairs they require, with the structural checklist in the lock's source documentation. No new subsystem or policy decision is needed. Source history still names `ae8cc8d76` as the latest change to this lock. Related open items #4589 and #4605 overlap the generation guard; they are not evidence of delivery.

## Design

Preserve the existing generation-file protocol and its public signature in we:scripts/conveyor/health-file-request.mjs. Retain all generation tombstones instead of pruning them: a delayed observer of generation g must always encounter an existing g+1 filename once any successor has acquired. This is the already-listed non-pruning repair, not a new counter or lock subsystem. A fixed last-N retention window cannot protect an arbitrarily delayed observer. Keep exclusive creation, fd-consistent observation, and release through the holder's own descriptor opened without creation. Replace the maximum-generation spread with a reduction so retained history does not introduce an argument-count limit.

For stale legacy unlink, continue immediately only on successful removal or ENOENT. Other unlink errors must fall through to the existing deadline and sleep path, eventually producing the existing timeout error without running the callback. Preserve fresh-legacy waiting and successful stale-legacy migration.

Put the structural checklist beside `withLedgerLock` in we:scripts/conveyor/health-file-request.mjs: enumerate observation, exclusive acquisition, release, and cleanup; prove names cannot be reused while an observer may remember them; exercise multiple intervening generations; and verify every failed retry reaches a deadline. This implementation satisfies the no-deleted-tombstones branch. Any future bounded-retention replacement must independently prove its acquisition validation closes stale-observer admission; a counter or post-acquire read alone is not such a proof.

The existing mtime assumption remains: a live critical section must finish within `staleMs`. This work does not claim exclusion after an active holder exceeds that threshold, or solve concurrent operation of legacy and new daemon versions.

## MVP

1. Add deterministic multi-generation regressions to we:scripts/conveyor/__tests__/health-file-request.test.mjs and demonstrate their failure against the current source.
2. Remove older-generation deletion and correct the lock documentation in we:scripts/conveyor/health-file-request.mjs. Update the superseded-holder assertion in we:scripts/conveyor/__tests__/health-file-request.test.mjs to expect retention while still verifying that an old holder's release leaves its successor untouched.
3. Add unlink-failure regressions in we:scripts/conveyor/__tests__/health-file-request.test.mjs, then repair deadline routing in we:scripts/conveyor/health-file-request.mjs.
4. Replace the obsolete rename-only assertion/comment in we:scripts/conveyor/__tests__/health-file-request.test.mjs with coverage of the actual lock protocol. Keep the existing real-process contention test. Add the source checklist and link its obligations to the regression names.

## Test plan

All matching tests live in we:scripts/conveyor/__tests__/health-file-request.test.mjs; the source/test pairing is already explicit in scope.

- Multi-generation stale observer: parameterize at least two and three intervening acquisitions through a one-shot `afterObserve` hook. Complete earlier successors with the real function, leave the newest generation freshly held, and assert the delayed callback never runs, timeout occurs, and the newest contents stay unchanged. Then release the newest generation and assert a fresh call progresses. Use a generous `staleMs` relative to the short test deadline.
- Actual occupancy: for the delayed multi-generation schedule, use a child-process barrier to pause the observer in `afterObserve`, run a successor to completion, then hold the next successor while resuming the observer. Assert peak occupancy is one and both processes eventually complete after release. Bound every barrier and kill/clean up workers on failure.
- Tombstone retention: assert all acquired generation names remain after multiple releases, stale exclusive creation gets EEXIST, and the superseded-holder release still touches only its own generation. Retain exception-release and normal progress coverage.
- Legacy unlink failure: inject EACCES and EPERM for removal of an old, readable legacy file without relying on filesystem permissions or user privileges. Run the production function in a child harness with a parent watchdog, since the old synchronous loop would otherwise hang the test worker. Assert the function's own timeout message, callback count zero, and no watchdog termination after the fix. Separately cover successful unlink, ENOENT race, and fresh-legacy timeout. Isolate/reset filesystem mocks so other tests remain real-filesystem tests.

## Proof plan

From the WE repository root, run the focused Vitest file named we:scripts/conveyor/__tests__/health-file-request.test.mjs through the repository's heavy-admission wrapper we:scripts/readiness/heavy-admission.mjs (arguments: `run -- vitest run` followed by the test's repository-relative path). Record the exact command and output with the implementation review.

First run the new regressions against the pre-fix source: the delayed observer must enter incorrectly and the denied-unlink worker must hit the watchdog. After the repairs, require stale admission to be refused and the unlink path to emit its own timeout. The full focused file must pass, including real-process contention and ordinary ledger operations. Run `npm run check:standards` and record results; the runner owns preparation checks and stamps. Do not represent this preparation-only probe as a completed regression suite.

## Done when

The focused test command described above fails on the pre-fix source and passes with the repairs; it covers multiple generations, actual mutual exclusion, retained tombstones, and denied legacy unlink reaching its own deadline. The source checklist accurately describes the shipped algorithm, and no obsolete pruning/rename assertion remains in the affected tests.

## Follow-ups

- Reconcile shared generation-guard evidence with #4589 and #4605 during delivery, without closing either wholesale: mixed-version legacy compatibility and other findings in those items are separate obligations.
- Retaining tombstones grows directory size and scan cost with acquisitions. Measure this before designing compaction; online deletion without a proven observer-safe protocol must not return as a cleanup optimization. This item does not introduce a retention policy or permanent-counter architecture.
- Property/model checking can extend the deterministic schedules later; it is not a substitute for this item's executable production-function regressions.
