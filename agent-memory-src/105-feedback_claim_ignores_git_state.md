---
name: feedback_claim_ignores_git_state
description: "Backlog claim/eligibility ignores git: ownership is status:active (+reserve holds), never the working tree's commit state"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5aa7343f-159b-49a7-ab40-98e3d56346c8
---

`backlog.mjs claim` does NOT look at git/commit state — the old `isDirty` guard was removed (2026-06-13). Concurrency/ownership is the `status: open → active` transition (a second claimer hits `active` and the transition errors) plus `reserve` session soft-holds (#083). The working tree's commit state is irrelevant to whether an item is taken or workable.

**Why:** the user keeps a perpetually-dirty tree (lots of in-flight uncommitted work); a git-dirty check produced false positives that wrongly held ready items out of a batch. File ownership (status) already covers concurrency, so the git check was redundant AND harmful. The user was explicit: "claim should not even look at if committed or not — we have file ownership for that."

**How to apply:** NEVER run `git status`/`git diff` to judge backlog eligibility or whether an item is taken, and NEVER drop/skip an item because it (or the tree) has uncommitted edits — that is not a drop-reason. The only "taken" signal is `status: active`. There is no `dirty` drop-reason anymore (renamed to `taken` = already active). Codified in [docs/agent/backlog-workflow.md](docs/agent/backlog-workflow.md) (Gather, Claim, drop-reason classifier) + batch SKILL.md. Relates to [[feedback_no_commit_talk_in_backlog]] and [[feedback_batch_conflict_avoidance]].
