---
name: feedback_concurrent_resolve_revert_verify_at_commit
description: "a concurrent session can revert your `resolve` status between resolve and commit; verify status:resolved persisted in the commit"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 60f1ce32-2292-40ac-aeb3-3e8b49f17e68
---

In a long batch, a concurrent session writing the same `backlog/*.md` can revert your `resolve` **between the `backlog.mjs resolve` call and your `git commit`** — the resolve stamps `status: resolved` in the working file, but the file on disk is rewritten back to `status: active` before you stage it, so your own commit captures `active` (stamps `dateResolved`/`graduatedTo` gone). The substance (code, JSON) commits fine; only the item status silently reverts, so it looks done but reads `active` to the next session. Observed live in batch-2026-06-23-1725-1665 on #1742 + #1726.

**Why:** the working tree is shared across concurrent sessions; `resolve` is a file splice, not atomic with your commit, and another session's claim/write on the same item wins the race in the window between them.

**How to apply:** resolve→commit as tightly as possible (don't interleave other work between them); after committing an item, a one-line `git show HEAD:backlog/<NNN>-*.md | grep status` confirms `resolved` actually landed. At close, sweep every item you resolved (`grep ^status:` each) — any that reads `active` is your completed work whose stamp was reverted: re-`resolve` + commit. Distinct mechanism from [[feedback_concurrent_sessions_sweep_staged_index]] (that's `git add -A` absorbing your *staged* changes; this is the *working file* reverting before you stage). Both are the shared-tree concurrency tax — see also [[feedback_batch_conflict_avoidance]].
