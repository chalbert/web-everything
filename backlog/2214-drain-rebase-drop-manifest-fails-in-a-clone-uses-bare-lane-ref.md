---
kind: story
size: 2
relatedTo: ["2198", "2197"]
status: open
dateOpened: "2026-07-03"
tags: [lane, pr-flow, merge-queue, drain, git]
---

# The drain's rebase-drop-manifest fails in a clone — it references the bare `lane/*` ref, not `origin/lane/*`

The #2198 auto-rebase-drop (`we:scripts/lib/rebase-drop-manifest.mjs`) is supposed to let the drain land a
BEHIND / manifest-only-conflicting PR with no manual rebase. But it never actually fires successfully from an
isolated clone (the #2197 model): it passes the **bare** head-ref name to git — `git merge-tree --write-tree
<base> <laneRef>` and `git commit-tree … -p <laneRef>` — but in a fresh clone the lane branch only exists as the
**remote-tracking** ref `origin/<laneRef>`, so git reports *"`lane/…` — not something we can merge"* and the
helper returns `{ action:'error', reason:'merge-tree produced no tree' }`. The drain then leaves the PR skipped.
Observed live 2026-07-03: every BEHIND PR this session (#71/#73/#74) had to be rebased by hand — the auto-path
was inert.

**Fix:** resolve the lane ref to its fetched form for the merge inputs — `git fetch origin <laneRef>` first
(or reuse the manifest fetch), then feed `origin/<laneRef>` (or `FETCH_HEAD`) to `merge-tree`/`commit-tree`,
while still **pushing** to the bare `refs/heads/<laneRef>` (that part is correct). Add a unit test that the
merge/commit inputs use the resolved remote ref, not the bare name. This is what makes #2198 actually work
unattended (the whole point — no per-PR manual rebase). Relates to #2198 (the helper) and #2197 (the clone
model that surfaces it).
