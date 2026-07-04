---
name: feedback_concurrent_sessions_sweep_staged_index
description: "concurrent agent sessions in this repo run broad git add -A / commit -a that absorb another session's STAGED index — commit promptly, keep the staging window tiny"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 91e965a6-879a-472c-b4bf-bdd6681f8fbe
---

In webeverything, multiple agent sessions share ONE working tree, and some run broad `git add -A` / `git commit -a`. Twice in one session a concurrent commit **absorbed my explicitly-staged index** between my `git add` and my `git commit` — my changes landed under THEIR commit message (work preserved, provenance lost), and my own `git commit` then found nothing staged.

**Why:** already-committed work is immune to the sweep (`git add -A` only stages unstaged/untracked); the exposure is the window where MY changes sit STAGED-but-uncommitted. A big accumulating dirty/staged tree across a whole batch is the maximal target.

**How to apply:**
- Stage + commit in one tight motion (stage explicit paths, then commit immediately — never leave a staged index sitting). Smaller, faster commits beat one big end-of-batch commit here (see [[feedback_backlog_closeout_resolve_not_delete]] / [[feedback_no_commit_talk_in_backlog]] — stage only my piece, never `-A`).
- If a commit reports "nothing staged" right after I staged, suspect the sweep: check `git log -1` / `git show HEAD --stat` — my work is likely already in the concurrent commit; verify HEAD is complete rather than re-doing it.
- For batches, the structural fix is the #1147 integration-branch landing: assemble on a throwaway branch, land with ONE `git merge` (near-atomic, minimal window). Generalize to serial batches if the race keeps biting.
- This is git-state, not ownership: claim/active still governs work ownership ([[feedback_claim_ignores_git_state]]); a dirty tree is never a drop reason.
