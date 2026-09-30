---
kind: story
size: 3
status: open
scope: ["we:scripts/conveyor/health-file-request.mjs", "we:scripts/conveyor/__tests__/health-file-request.test.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3088's independent review

Filed mechanically by the unattended review loop (#2749) — every finding below reduced chalbert/web-everything#3088's review (reviewed head `ae8cc8d76acd0439da32d7abd118baa666ef97f5`) to prevention-outstanding by naming a guard neither captured nor filed:

1. `we:scripts/conveyor/health-file-request.mjs:286` — Add a multi-generation interleaving test using the `afterObserve` seam. Prune only tombstones at least two generations old, or treat a vanished observed gen (`!obs` with `cur>0`) as 're-observe' rather than 'takeable'. File as a backlog item for a lock-protocol model-check or property test.
2. `we:scripts/conveyor/health-file-request.mjs` — Add a model-style test that uses the afterObserve seam to run N>=2 full lock cycles between observe and take. Alternatively, prune only gens <= myGen-2, or never reuse names by keeping a monotonic high-water marker file.
3. `we:scripts/conveyor/health-file-request.mjs` — Document, or gate at deploy time, that only one health-daemon version runs during the cutover, and add a test for an old-scheme wx lock appearing while a gen lock is held. Alternatively, have the new scheme also take the legacy name exclusively.
4. `we:scripts/conveyor/health-file-request.mjs` — Move the prune inside the try, or wrap it in try/catch. A review lens on 'work between acquire and try/finally' would catch this class.
5. `we:scripts/conveyor/health-file-request.mjs:299` — Add a deterministic regression test using afterObserve to complete one successor acquisition and resume the original waiter inside the next successor's critical section; assert that the original waiter cannot enter. Require this test in the normal test gate.
6. `we:scripts/conveyor/health-file-request.mjs:261` — A concurrency stress test simulating multi-generation delays (e.g., a waiter pausing in `afterObserve` while the lock cycles multiple times) would explicitly catch ABA regressions.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
