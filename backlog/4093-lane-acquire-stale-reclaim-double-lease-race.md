---
bornAs: xx87m6a
kind: story
size: 3
status: open
dateOpened: "2026-09-24"
tags: []
---

# lane-pool acquire hands one lane to two sessions when both reclaim the same stale lease

Two concurrent `lane-pool acquire` calls both won lane-37 on 2026-09-24 (reflog: two reset-to-origin/main at 19:36:01 and 19:36:02 EDT; lease rewritten 19:36:04 by the second, which also unmapped the first item from we:.claude/lane-ports.json). Root cause: `tryClaimLane` in we:scripts/lane-pool.mjs reclaims a TTL-stale lease with `rmSync` then `wx`-create, commented "unlink→create race: acceptable". It is not: B can `rm` the fresh lease A just created and create its own, so both return success and edit the same clone. Fix: make stale-reclaim compare-and-swap (reclaim lock, or rename-to-tombstone + re-verify it was the stale lease), prove with a concurrent-acquire test and a mutation-check.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
