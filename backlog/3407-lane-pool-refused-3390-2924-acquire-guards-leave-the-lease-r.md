---
bornAs: xenqv9f
kind: story
size: 2
status: resolved
scope: ["we:scripts/lane-pool.mjs", "we:scripts/__tests__/lane-pool-acquire-refused-lease.test.mjs", "we:scripts/__tests__/lane-pool-acquire-reverify-containment.test.mjs"]
dateOpened: "2026-08-30"
dateStarted: "2026-09-24"
dateResolved: "2026-09-24"
graduatedTo: "we:scripts/lane-pool.mjs"
costTokens: "in:130 cw:143479 cr:7827868 out:25088"
costUsd: 5.98
costSessions: 1
tags: []
---

# lane-pool: refused #3390/#2924 acquire guards leave the lease reassigned to the failed requester

`cmdAcquire`'s new #3390 (explicit-lane dirty/ahead) and #2924 (re-verify-containment) guards call `fail()` *after* `tryClaimLane` has already reclaimed a stale lease and written a fresh marker under the failing session. A refusal therefore leaves the lane held by the failed requester instead of restored to its prior (reclaimable/stale) state — locking out both the real owner (if the lease was live, not stale) and any other investigating session (for up to the default 240min TTL, or until a manual `release --force`).

Confirmed empirically by the /review #1710 juror panel (correctness + security lenses, both CONFIRMED, both `carve-out` — not worse than base's prior unconditional destruction, so non-blocking). Its line numbers (1044, ~1108) are stale; the current ones are below.

## Where it happens (re-read against main `fbd289bfc`, 2026-09-24)

- `fail()` (we:scripts/lane-pool.mjs:1037) writes to stderr and calls `process.exit(1)`. It does no rollback.
- **Explicit-lane path:** `tryClaimLane` (we:scripts/lane-pool.mjs:1138) writes the lease at :1379. The #3390 dirty/ahead refusal then calls `fail()` at :1419.
- **Auto-pick path:** the candidate loop claims at :1460 (it already retries the next candidate on a lost claim race). The #2924 post-fetch re-verify (`aheadIsProvablyPushed` over `localRemoteShas`, right before the destructive reset) calls `fail()` at :1511. That check runs after the loop has already chosen and claimed one lane, so a refusal exits the whole command.

## Observed live (2026-09-23)

An agent ran `acquire` with no `--lane`. Auto-pick claimed lane-11 and wrote its lease. The #2924 re-verify then found **148 unpushed commits** and refused the lane. The refusal was correct: it protected the work. But the command exited without releasing the lease it had just written, and it did not try another lane. Lane-11 then read as leased by someone else until the TTL ran out or someone ran `release` by hand.

## Why it matters (related: #4014)

Every refused acquire leaks one lease and silently removes one lane from the acquirable pool. At scale the pool looks full, which makes provisioning clone more lanes. That is the growth #4014 (pool hard cap, recycle before clone) is trying to bound. So fixing the leak here removes one of the inputs that drives the pool toward #4014's cap.

## Fix

1. **Release on refusal.** Once `tryClaimLane` succeeds, any later refusal or throw in `cmdAcquire` must release the lease it just wrote before exiting, with try/finally or an equivalent rollback, so it cannot depend on each `fail()` call site remembering. Deferring the stale-lease reclaim in `tryClaimLane` until after the checks pass is also acceptable. Either way, an explicit-lane refusal must leave the lane with **no lease from this requester**. If the claim reclaimed a stale lease, restoring that prior marker is also fine.
2. **Auto-pick falls through.** In auto-pick mode, a lane refused by the #2924 re-verify (or any other post-claim safety check) is released and skipped, and the command goes on to the next acquirable candidate. It should only fail with "no free lane" once every candidate has been claimed-and-refused or is held. The explicit-lane path still fails, since the caller named that lane.
3. The refusal message itself (and `--force`) stays as it is. This card changes only what happens to the lease and to the candidate loop.

## Done when

1. **Executable** — `npx vitest run lane-pool-acquire-refused-lease` passes. The new suite builds a temp pool and asserts that **a claimed-then-refused lane has no lease afterwards**, on both paths:
   - **explicit-lane** (`acquire --lane=N` on a lane that is ahead of origin with work that isn't provably pushed, so the #3390 guard refuses): the exit code is non-zero, and afterwards the lane has no lease marker (or, if it had a stale one before, not one naming the failed requester).
   - **auto-pick** (two lanes: the lower-numbered one passes the first acquirable check but holds unpushed commits that the #2924 post-fetch re-verify catches; the other is clean): the command succeeds and returns the clean lane, and afterwards the refused lane has no lease marker.
   - **auto-pick, every candidate refused:** the command fails with the no-free-lane error, and no refused lane is left with a lease.
   It fails today: the refused lane keeps the lease, and auto-pick exits on the first refusal.
2. **Executable** — `npx vitest run lane-pool` stays green (including we:scripts/__tests__/lane-pool-acquire-reverify-containment.test.mjs).
3. **Executable** — `npm run check:standards` reports 0 errors.
