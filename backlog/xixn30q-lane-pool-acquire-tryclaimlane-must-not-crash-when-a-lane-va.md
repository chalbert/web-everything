---
kind: story
size: 2
status: resolved
scope: ["we:scripts/lane-pool.mjs"]
dateOpened: "2026-09-24"
dateStarted: "2026-09-24"
dateResolved: "2026-09-24"
tags: []
---

# lane-pool acquire: tryClaimLane must not crash when a lane vanishes (ENOENT)

we:scripts/lane-pool.mjs tryClaimLane's create-or-fail write (the O_EXCL lease marker) only special-cases EEXIST; a concurrent deletion of the lane dir/.git (e.g. a race with cmdTrim, or any other external removal) throws an uncaught ENOENT instead of returning null, crashing the whole acquire instead of letting the caller's auto-pick loop try the next lane. Live-caught: wev-review-daemon session review-2549 (33f5d292, 2026-09-24 13:15 ET) crashed at we:scripts/lane-pool.mjs line 1261 writing a lease marker into a lane dir that a concurrent trim had already removed. cmdTrim's own TOCTOU race-safety (per-lane claim lock + invalidateListCache) is already live on main; this item hardens tryClaimLane itself, the residual gap for ANY cause of a lane vanishing mid-acquire.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
