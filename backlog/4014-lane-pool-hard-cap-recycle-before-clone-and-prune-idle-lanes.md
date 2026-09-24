---
bornAs: x3njiym
kind: story
size: 5
status: open
blockedBy: ["4000"]
scope: ["we:scripts/lane-pool.mjs", "we:scripts/lib/lane-lease.mjs"]
dateOpened: "2026-09-23"
tags: []
---

# Lane pool: hard cap, recycle-before-clone, and prune idle lanes above the cap

Observed 2026-09-23: the WE lane pool grew to ~129 lanes, 45 cloned that day while 88 sat unleased (30 leased); each fresh lane writes ~8.6k tracked files + ~18.8k node_modules files (463MB), ~1.2M file creates / ~21GB that day, driving fseventsd to ~100% CPU. Cause: we:scripts/lane-pool.mjs#cmdProvision --acquirable grows past foreign-leased/dirty lanes up to count + ACQUIRABLE_PROVISION_HEADROOM (32), and provisionLane/cloneLane clone a fresh lane instead of reusing an unleased one. Plan: (1) absolute hard pool cap (config/flag, default ~48) that provision and acquire refuse to clone past, logging contention instead; (2) recycle before clone - prefer resetting an unleased lane whose dirty/ahead work is provably pushed (reuse aheadIsProvablyPushed and the #2267 dirty-or-ahead guard) over cloning a new one; (3) prune idle lanes above the cap - never leased, dirty or unpushed ones. SEQUENCING: PR #2547 (card #4000, was xjyn3fg; merged 2026-09-23) reworked we:scripts/lane-pool.mjs list --acquirable / aheadIsProvablyPushed; build on top of it.

## Done when

1. **Executable** — a new `we:scripts/__tests__/` vitest (fixture pool in a tmp dir) proves: `provision --acquirable` with the cap reached clones nothing new and logs contention; with an unleased, provably-pushed lane available it resets that lane instead of cloning; `prune` removes only idle lanes above the cap and never a leased, dirty, or unpushed one. Fails on origin/main, passes after.
2. **Observed** — on the real WE pool, `node we:scripts/lane-pool.mjs provision --acquirable --count=<n>` run twice back to back clones zero new lanes the second time, and the lane count never exceeds the cap.

## Sizing note

Three behaviours in one file; they share the same "which lanes are free" read, so they ship together. If the prune step grows (e.g. needs its own scheduling), split it out.
