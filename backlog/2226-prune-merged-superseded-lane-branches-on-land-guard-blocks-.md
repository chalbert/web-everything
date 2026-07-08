---
kind: story
size: 3
status: resolved
dateOpened: "2026-07-07"
dateStarted: "2026-07-08"
dateResolved: "2026-07-08"
tags: []
---

# Prune merged/superseded lane branches on land — and the lane guard blocks the delete

`lane/*` refs accumulate on origin indefinitely: the drain squash/rebase-lands via PR, so a landed lane never becomes a topological ancestor of `main` and `git branch --no-merged` keeps reporting it forever (+1 ahead / hundreds behind). Observed 2026-07-07: 34 `lane/*` refs on origin, of which only 1 (`#2125`, a live PR) carried real unmerged code — the rest were either already-merged or **superseded ghosts** whose only "delta" vs main is git conflict markers (an older prose/date variant main has since replaced). Nothing prunes them, so any future "what's unmerged?" review has to content-verify every ref by hand (three-way `git merge-tree` vs `origin/main`) to avoid mistaking a stale ghost for orphaned work — and a naive `--no-merged` list would wrongly flag ~30 dead branches as live.

Two things to build:

1. **Auto-delete the lane ref when its PR lands.** `we:scripts/pr-land.mjs` / the drain integrator should delete the source `lane/*` ref on origin after a successful merge (the couple's sibling ref too, cross-repo). Enable GitHub "automatically delete head branches" as a backstop for the self-approved PR path.
2. **A periodic content-verified sweep** for the historical backlog: for each `lane/*` not attached to an open PR, three-way merge it into `origin/main`; if the merged tree == main's tree (or the only delta is conflict markers on a `resolved` item), delete it. This is the manual procedure run this session — it should be a script (`we:scripts/prune-landed-lanes.mjs`) or a `/drain` subcommand.

**Footgun that blocks the fix:** the write-time lane guard (#2203) rejects `git push origin --delete lane/<x>` with "direct push to main is blocked" — it treats *any* `git push origin` as a candidate main write and can't tell a lane-ref *deletion* from a main push. This session had to delete via `gh api -X DELETE repos/:owner/:repo/git/refs/heads/lane/<x>` to get around it. The guard should allow (or the cleanup tooling should natively use the API for) lane-ref deletions. Relates #2203 (guard scope), #2269 (guard CLI-write gap), #2216 (unlabelled pending PRs left behind), #2290 (drain sole-writer).
