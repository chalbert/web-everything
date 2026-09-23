---
kind: task
parent: "3383"
status: resolved
dateOpened: "2026-09-23"
dateStarted: "2026-09-23"
dateResolved: "2026-09-23"
tags: []
---

# lane-pool: aheadIsPatchEquivalentToSomeRemoteHead is O(lanes x remote heads), stalls the fix daemon

#3383's own squash-merge patch-equivalence fallback (`we:scripts/lane-pool.mjs`, landed via PR #2542,
origin/main @ 38b8b0ab9) spawns one full `git cherry <remote-head> <lane-head>` PER live remote head, PER
ahead lane — O(lanes x heads). Live-caught on the real web-everything pool (83 lanes, 160 remote heads): a
single `list --acquirable` pass stalled 20+ minutes and hung the fix daemon's every WE tick (it calls this
list on every tick), independently reproduced (killed after 14+ min without finishing). Bounds the check to
(1) ONE `git cherry origin/<branch> HEAD` first (the common case — a lane's work lands on its own integration
branch), then (2) only if that finds nothing, a single O(1)-git-spawn-pair batched patch-id comparison
(`git diff-tree --stdin -p | git patch-id --stable`, once total, never once per head) against every OTHER
live remote head — narrower than `git cherry` (misses a squash combining several commits, or a match behind a
merge commit on the other branch) but bounded; a case it misses simply stays protected. Real dirty/ahead
lanes and the already-fixed litter-allowlist behavior are unchanged.

## Done when

1. **Executable** — `npx vitest run --config we:vitest.integration.config.ts we:scripts/__tests__/lane-pool-ahead-patch-equivalent-bounded-spawn.test.mjs`
   passes: the common (own-branch squash-merge) case resolves with a bounded git-spawn count even with many
   unrelated remote heads present; the fallback case (patch-equivalent to a DIFFERENT branch, not main) still
   resolves, also with a bounded git-spawn count; a genuinely unpushed/unrelated lane stays protected.
2. Timed proof against the real web-everything lane pool (83 lanes, 160 remote heads): `list --acquirable
   --repo=<checkout>` completes in ~43-50s (measured), down from 20+ minutes unbounded/never-finished before
   this fix — bounded to O(lanes), never O(lanes x heads): a spawn-count audit of the same run shows 32
   `cherry` calls (one per ahead lane needing the primary check) and 40 `diff-tree` calls (20 lanes' worth of
   the 2-call batched fallback), never scaling with the 160 remote heads. This is slower than the pre-#3383
   ~14s baseline (which never did any squash-detection at all) because 32 of 83 lanes are genuinely ahead in
   the real pool right now and each pays one real `git cherry` against a large, actively-diverging monorepo
   history — a real, bounded cost, not a residual unbounded factor.
3. Read-only, against the live plateau-app pool: the acquirable set (1,2,4,6,7,9,10,11,12,14) is unchanged
   from #3383/xddtgll's own verification (confirmed again here, ~4s).
