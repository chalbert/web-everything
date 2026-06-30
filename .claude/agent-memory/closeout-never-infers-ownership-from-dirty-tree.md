---
name: closeout-never-infers-ownership-from-dirty-tree
description: Batch/agent closeout must scope to its own changeset — never infer ownership from the shared dirty tree (it clobbers concurrent sessions)
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 52531e5b-992c-42e6-a43c-ffdb25fadf66
---

A `/workflow` (parallel) batch closeout ran in the shared primary checkout, diffed the dirty working
tree to find "its own residue", mis-read a **concurrent `/prepare` session's** in-progress #1983 work as
batch residue, and `git checkout`/`rm`'d it. No permanent loss only because that session was still live
and re-saved. Verified: no lane ever wrote those files — the collision was cross-*session*, in the one
tree both shared.

**Why:** the primary checkout is shared; a dirty tree is the baseline (other sessions' uncommitted work
lives there normally). Inferring "what I own" from `git status` cannot tell your residue from a stranger's
live edits, so any destructive reaction (`checkout`/`rm`/`stash`) can erase another session's work.

**How to apply:** during any automated closeout/integration, act **only** on files in your own recorded
changeset/manifest; **never revert or delete a file you didn't write**, and never treat the working tree's
dirty state as truth about ownership. If something looks like "residue", confirm it's yours before
touching it. **Ratified by [[1985]] (Rung 1) as a forced invariant** — the dirty-tree-as-ownership
branch is *broken* (it destroyed a concurrent session's real work), not one option among peers: the
alternatives (session lock / commit-first) both need cooperation the colliding stranger session can't
be made to give, so "act only on your own manifest" is the no-bad-actor-needed form and the only
mechanism that survives. This is the durable principle #1985 codifies. Related:
[[parallel-workflow-blocked-by-git-guard]], [[workflow-crossrepo-lanes-falsedrop]].
