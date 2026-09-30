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

1. `we:scripts/conveyor/health-file-request.mjs:301` — Add a deterministic interleaving test that drives three or more generations through the `afterObserve` seam and asserts mutual exclusion. Alternatively, add a property/model-check style test over lock-state transitions for any CAS-by-name scheme.
2. `we:scripts/conveyor/health-file-request.mjs:297` — Add a multi-generation regression test using an `afterObserve` hook that advances the lock two generations, asserting the stale observer is refused. Either stop pruning below the current gen, or fix the claim by comparing the observed gen against a monotonic high-water mark (for example, keep a permanent counter file).
3. `we:scripts/conveyor/health-file-request.mjs:282` — Route the failed-unlink case through the deadline/sleep path (only `continue` on unlink success or ENOENT). Add a test with an un-unlinkable stale legacy file that asserts a timeout error.
4. `we:scripts/conveyor/health-file-request.mjs:279` — A structural design checklist for file-based CAS implementations, requiring that either tombstones are never deleted or the CAS token (generation) is re-validated after acquisition.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
