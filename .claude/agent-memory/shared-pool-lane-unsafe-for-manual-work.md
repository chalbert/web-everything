---
name: shared-pool-lane-unsafe-for-manual-work
description: A peer /workflow can reset --hard + clean -fd a shared lane-pool lane, wiping your uncommitted manual work
metadata:
  type: feedback
---

Doing manual/agent edit work directly in a shared lane-pool lane (`~/workspace/.lanes/web-everything/lane-N`)
is UNSAFE: `scripts/lane-pool.mjs provision|refresh` runs `git reset --hard origin/main` + `git clean -fd` on
those lanes, so a concurrent `/workflow` (or any pool refresh) can silently destroy your uncommitted edits AND
reset tracked-file changes out from under you. Hit live on 2026-07-03 during the #2183 implementation — lane-5
was wiped mid-session (all backlog items + the workflow rewrite gone).

**Why:** the pool is a fungible resource the orchestrator owns; it assumes any lane is disposable between runs.

**How to apply:** for a lane->PR session that ISN'T the /workflow orchestrator itself, make your OWN dedicated
clone OUTSIDE `.lanes/` and outside the primary repos (e.g. `~/workspace/we-<slug>`), which the #2123
[[single-session-should-use-a-lane]] guard still allows (it only blocks primary-tree edits). Clone with
`--reference <primary>` for speed, symlink `node_modules` from the primary to skip `npm ci`, and commit +
push the `lane/*` ref EARLY so the work is durable on origin regardless of any local reset. The branch guard
blocks `git checkout -B`/`switch` even in a clone — use `git merge --ff-only <sha>` to move main.
