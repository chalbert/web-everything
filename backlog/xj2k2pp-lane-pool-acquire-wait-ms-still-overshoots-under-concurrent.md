---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lane-pool.mjs"]
dateOpened: "2026-09-25"
tags: []
---

# lane-pool acquire --wait-ms still overshoots under concurrent load: waiters fail in a serialized staircase up to 3x the wait

Found by the daemon soak harness (card x0zg44l, break lane-acquire-under-load). On current main (after b6c6dee34, the shared-scan fix), 5 concurrent real calls of we:scripts/lane-pool.mjs acquire --wait-ms=20000 on a saturated 14-lane sim pool (one lane freed 2s in, git slowed +0.2s per call) return at 33s, 34s, 45s, 56s and 68s: one gets the freed lane, the rest give up one after another about 11s apart, so the wait is not a bound and the last waiter takes 3.4x its wait. Measured twice (load avg 44 on the host). The pre-fix code (b6c6dee34 parent) returned all five at about 34s in the same world, so the shared scan made the tail worse at this scale. Live symptom this matches: review sessions timing out on lane acquire under machine load. Proof: SOAK_LOAD_LANES=14 SOAK_LOAD_CALLERS=5 node we:scripts/conveyor/soak/run.mjs break lane-acquire-under-load must turn GREEN.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
