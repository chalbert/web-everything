---
name: index-batch
description: Batch execution and commit/git discipline: claim before coding, points-budget is the sole stop, batch conflict avoidance via per-item claim, gate-red stop scoped to own files, commit per finished piece with tight pathspec, never push, never git add -A, concurrent staged-index sweep, concurrent resolve revert (verify it persisted), commit on the current branch. Recall when batching items or committing work.
metadata:
  type: reference
---

Batch · Commit · Git Hygiene cluster — open a leaf with `node scripts/memory-resolve.mjs <N>` (or `--cat`):

- 50. Gate-Red Stop Scoped To Own Work — batch gate-red stop = ONLY the batch's files; step over concurrent red; #664
- 61. Batch Working Practices — claim before coding; pre-flight forks; cluster by repo
- 63. Batch: Never Self-Judge a Stop — points budget=SOLE stop driver; never self-judge mid-run; 4 hard stops
- 101. Commit Each Finished Piece, Never Push — commit per closed item, staging ONLY that piece's files; never push/`add -A`
- 102. Concurrent Sessions Sweep Staged Index — others' `git add -A` can swallow my staged work; commit tightly; #1147
- 103. Concurrent Resolve Revert — concurrent write can revert `resolve` pre-commit; verify it persisted; #1742
- 104. Commit On Current Branch — commit on checked-out branch, never branch-first; `checkout -b` corrupts sessions; never-push
- 122. Batch Conflict Avoidance — per-item claim (status:active) dodges races, NOT git-status; splice data edits
- [Monolith-split vs partition for parallel capacity](monolith-split-vs-partition-capacity.md) — only entry-COLLECTIONS split; for docs/matrices/sweeps the lever is a precise pairwise partition + optimistic merge, not splitting; #1949
