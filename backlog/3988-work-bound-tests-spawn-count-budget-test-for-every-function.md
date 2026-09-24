---
bornAs: x3xz8qp
kind: story
size: 3
parent: "3383"
status: active
scaffoldedBy: "session-3383-lane-guard"
dateScaffolded: "2026-09-23"
scope: ["we:scripts/lane-pool.mjs", "we:scripts/readiness/conveyor-state.mjs", "we:scripts/readiness/scope-lease-collect.mjs", "we:scripts/readiness/dispatch-plan.mjs"]
dateOpened: "2026-09-23"
tags: []
---

# work-bound tests: spawn-count budget test for every function that spawns git/gh per lane/branch/PR

PR #2542 introduced an O(lanes×heads) `git cherry` loop in `we:scripts/lane-pool.mjs`'s `list
--acquirable` (20+ minute stalls); #2547 bounded it to one `git cherry` + a cheap containment check per
lane. #2920 was the same shape (`aheadIsProvablyPushed`, 677 spawns for one `acquire`), fixed the same
way, with a pinned spawn-count regression test
(`we:scripts/__tests__/lane-pool-ahead-provably-pushed-single-spawn.test.mjs` /
`we:scripts/__tests__/lane-pool-ahead-patch-equivalent-bounded-spawn.test.mjs` are the pattern to copy:
a large synthetic fixture with MANY lanes/heads, asserting total git/gh process count stays flat, not
O(n×m)). This item extends that pattern to every OTHER per-lane/per-branch/per-PR fan-out that spawns
`git`/`gh`, so the next O(n×m) loop gets caught before it ships, not after an hour-long stall. Candidate
loops noticed while working #3383's lane-pool guard fix: `we:scripts/readiness/conveyor-state.mjs`'s
per-PR `gh` enrichment calls, `we:scripts/readiness/scope-lease-collect.mjs`'s per-lane `git remote
get-url`/lease reads, and `we:scripts/readiness/dispatch-plan.mjs`'s already-done ground-truth `gh pr
list --search` per stale queue id (already made concurrent, not spawn-bounded, per its own #3383 header
comment).

## Done when

1. **Executable** — a new spawn-count budget test per candidate function above (large synthetic
   fixture: many lanes/heads/PRs), asserting the git/gh process count stays flat rather than scaling
   with lane/head/PR count; each fails against the current unbounded implementation if one is found,
   and passes once bounded (or simply documents+pins an already-bounded implementation).
