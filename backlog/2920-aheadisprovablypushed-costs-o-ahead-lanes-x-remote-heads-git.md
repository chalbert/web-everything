---
bornAs: xxpozbx
kind: task
status: open
dateOpened: "2026-08-05"
tags: []
---

# aheadIsProvablyPushed costs O(ahead-lanes x remote-heads) git spawns — ~30s per acquire on the live pool

PR #1022 review finding 3, filed under the no-regression land bar (the cost exists only on the hand-run acquire path today, so it is not a regression against main — but it blocks widening the fix to list --acquirable). Replicated read-only against the real 38-lane pool and real origin (29 heads): one infoFor pass = 677 git spawns / 29,553 ms, of which ls-remote is only 0.65s; the rest is a per-lane loop over every remote head at ~62ms per merge-base spawn. The lanes.filter(...).map(infoFor) sits INSIDE the while (chosen === null) claim-retry loop, so a lost O_EXCL race repeats the whole fan-out (the remoteShas memo is reused, the merge-base fan-out is not). Containment is answerable in ONE spawn per lane: git rev-list --max-count=1 HEAD --not <shas...> — empty output means every commit is contained. Also related: the ls-remote call has no timeout (we:scripts/lane-pool.mjs tryGit carries none) while the adjacent gh call sets 8000ms for exactly this reason.
