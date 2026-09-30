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

1. `we:scripts/conveyor/health-file-request.mjs:286` — Add a deterministic race test that drives two full lock cycles inside `afterObserve`. Alternatively, keep gen names never-reusable by pruning only gens ≤ myGen-K, or by keeping a persistent monotonic counter file.
2. `we:scripts/conveyor/__tests__/health-file-request.test.mjs:353` — Nest the second reclaimer inside the first's `afterObserve` or body, so occupancy can genuinely exceed 1. Or spawn real subprocesses, as the existing 'neither starved' test does.
3. `we:scripts/conveyor/health-file-request.mjs:298` — Keep the last N (at least 2) generations, or never reuse a name by making the generation number come from a persisted monotonic counter. Add a deterministic test that runs two full cycles inside the afterObserve hook and asserts the stale waiter is refused.
4. `we:scripts/conveyor/health-file-request.mjs:277` — Document the legacy shim as one-shot best-effort, or drop it. Alternatively, gate rollout so no old-scheme processes run concurrently with the new code.
5. `we:scripts/conveyor/health-file-request.mjs:297` — Add a deterministic regression gate that pauses a waiter after observation, advances through two successors, prunes the pending creation target, and asserts that the waiter cannot enter while the newest successor holds the lock.
6. `we:scripts/conveyor/health-file-request.mjs:276` — A concurrency fuzz test for `withLedgerLock` that simulates process scheduling delays (e.g., using `afterObserve` to advance the lock by two generations and prune the intermediate one) to verify mutual exclusion under arbitrary interleaving.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
