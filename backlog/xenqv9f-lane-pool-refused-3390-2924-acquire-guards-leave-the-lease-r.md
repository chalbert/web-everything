---
kind: task
status: open
dateOpened: "2026-08-30"
tags: []
---

# lane-pool: refused #3390/#2924 acquire guards leave the lease reassigned to the failed requester

`cmdAcquire`'s new #3390 (explicit-lane dirty/ahead) and #2924 (re-verify-containment) guards call `fail()` *after* `tryClaimLane` has already reclaimed a stale lease and written a fresh marker under the failing session. A refusal therefore leaves the lane held by the failed requester instead of restored to its prior (reclaimable/stale) state — locking out both the real owner (if the lease was live, not stale) and any other investigating session (for up to the default 240min TTL, or until a manual `release --force`).

Confirmed empirically by the /review #1710 juror panel (correctness + security lenses, both CONFIRMED, both `carve-out` — not worse than base's prior unconditional destruction, so non-blocking) on we:scripts/lane-pool.mjs:1044 (explicit-lane path) and ~we:scripts/lane-pool.mjs:1108 (auto-pick path).

Fix: either defer the stale-lease reclaim in `tryClaimLane` until after the #3390/#2924 dirty/ahead checks pass, or restore/release the marker on the way out when `fail()` fires after a successful claim. Add a regression test asserting lease/holder state after a refused acquire (no test in PR #1710's four files covers this).

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
