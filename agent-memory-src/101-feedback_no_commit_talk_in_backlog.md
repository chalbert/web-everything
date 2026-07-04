---
name: feedback_no_commit_talk_in_backlog
description: "Commit each finished piece of work (per closed backlog item), staging only that piece's files; NEVER push"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: d36387e1-d97e-45d4-81b6-a93c0e31ca1f
---

**Updated 2026-06-13 (supersedes the earlier "never touch commits" policy):** commit automatically each time a piece of work is finished. In backlog/batch work, "a piece" = one closed-out item — after `resolve`/`release` + the capture pass + a green gate, commit that item's changes with a clear message, then continue (one commit per closed item, not one lump at the end).

**Hard constraints:**
- **Stage only the files that piece touched** — explicit paths, NEVER `git add -A`. The working tree is routinely dirty with *other, unrelated* uncommitted work (the normal baseline); sweeping it into your commit is the failure to avoid.
- **NEVER `git push`** — the user owns pushing and the remote.
- Still don't audit/comment on unrelated changes already in the tree — commit your piece and move on.

**Why:** the user wants finished work durably captured as commits as it lands, but on a tree that legitimately carries lots of in-flight uncommitted work from other sessions — so selective staging + no-push is essential.

**How to apply:** close-out is now `… resolve <NNN>` → `git add <explicit paths>` → `git commit` (Co-Authored-By trailer), never push. Codified in [docs/agent/backlog-workflow.md](docs/agent/backlog-workflow.md) → Rules → "Commit each finished piece" and the batch SKILL.md loop step. Relates to [[feedback_backlog_is_tracker]], [[feedback_claim_ignores_git_state]].
