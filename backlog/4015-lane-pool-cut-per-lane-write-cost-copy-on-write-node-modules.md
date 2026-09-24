---
bornAs: x6oeb4m
kind: story
size: 5
status: open
blockedBy: ["4000"]
scope: ["we:scripts/lane-pool.mjs"]
dateOpened: "2026-09-23"
tags: []
---

# Lane pool: cut per-lane write cost - copy-on-write node_modules template and git object hygiene

Observed 2026-09-23: 52 WE lanes ran a fresh npm ci in one day with package-lock unchanged for a week (fresh clones, not lockfile bumps) - each ~18.8k files / 463MB; 17 lanes exceed git's gc.auto loose-object threshold (lane-27: 8,584 loose, 6,946 prunable); and the shared alternates object store (the main checkout .git) sat 11h behind origin, so every lane fetched objects into its own .git. Together this fed fseventsd ~100% CPU. Plan: (1) cheap deps - we:scripts/lane-pool.mjs#ensureDeps populates node_modules via APFS copy-on-write (cp -Rc) from a template dir keyed by the lockfile hash (the same hash depsReady/lockHash already compute), falling back to npm ci when the template is missing or the clone fails; (2) git hygiene - fetch once in the alternates source before a pool-wide refresh/provision so lanes borrow objects instead of duplicating them; set gc.auto=0 in lanes plus a scheduled git maintenance / repack -adl; core.untrackedCache=true in lane config. SEQUENCING: PR #2547 (card #4000, was 4000; merged 2026-09-23) reworked we:scripts/lane-pool.mjs list --acquirable / aheadIsProvablyPushed; build on top of it.

## Done when

1. **Executable** — a new `we:scripts/__tests__/` vitest proves `ensureDeps` copies from a lockfile-hash-keyed template when one exists (no `npm ci` spawned), falls back to `npm ci` when it does not or the copy fails, and seeds the template after a successful `npm ci`. Fails on origin/main, passes after.
2. **Observed** — on the real WE pool: a freshly cloned lane gets `node_modules` in seconds via `cp -Rc` (log line shows the template path); `git -C <lane> config gc.auto` prints `0` and `core.untrackedCache` prints `true`; a pool-wide refresh logs one fetch in the alternates source before touching lanes.

## Sizing note

Two independent halves (deps template; git hygiene). If either grows past a small change, split the git-hygiene half into its own card — the deps half is the bigger win.
