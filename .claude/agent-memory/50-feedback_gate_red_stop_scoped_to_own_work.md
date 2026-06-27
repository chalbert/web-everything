---
name: feedback_gate_red_stop_scoped_to_own_work
description: "batch gate-red stop applies ONLY when an error implicates the batch's own work; a red purely from a concurrent session's files is noted and stepped over, never a stop"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a98c90d1-7de8-4a46-8645-73c4854ab6ba
---

A batch's **"gate red" hard-stop must be scoped to the batch's OWN work.** If `check:standards`
(whole-repo) is red but **none of the errors implicate files this batch touched** — e.g. they're
untracked/in-flight files from a *concurrent* batch (another session's new item, an unregistered
report) — that is **NOT a stop**: note it and continue with the (independent) remaining items.

**Why:** stopping on someone else's red gate defeats the whole concurrent-batch design (per-item claim
+ reservations exist precisely so two batches run on separate stuff at once). In batch
`batch-2026-06-14` I stopped at 29/58 pts because `#664` (wiki-links) + a hidden split report — both
untracked, neither mine — turned the gate red; the concurrent session then cleared them AND finished my
carry-forward items (#416/#417). The over-conservative stop cost throughput for nothing.

**How to apply:** when the gate goes red mid-batch, first diagnose (grep the error lines, `git status`):
do any errors name a file in this batch's changeset? **Yes → real stop** (never build on my own broken
foundation). **No (all external/concurrent) → step over it**, log one line that the red is external, and
keep claiming my independent items. The safety intent is "don't compound MY breakage", not "freeze on any
repo-wide red." Pairs with [[feedback_claim_ignores_git_state]] (a dirty/untracked tree is the normal
baseline) and [[feedback_batch_conflict_avoidance]] (concurrency owned by status + reservations, not git).
Codify in docs/agent/backlog-workflow.md → "The stop rule".
