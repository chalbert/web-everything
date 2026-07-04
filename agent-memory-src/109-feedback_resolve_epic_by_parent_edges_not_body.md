---
name: feedback_resolve_epic_by_parent_edges_not_body
description: "Before resolving a storied epic, enumerate children by the parent: field, never the body's \"N children\" listing — the listing goes stale as new children are parented later"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: dc32a352-e48c-4bd2-a2d0-cd2585947a27
---

Before resolving a storied epic, derive its completeness from the real `parent:` edges across `backlog/*.md`, NOT from the epic body's "sliced into N children" prose listing — that listing goes stale as new children are parented in later.

**Why:** On `/next 658` (2026-06-17) the epic body documented 5 children (#693–#697), all resolved, so I claimed and resolved the umbrella. The `check:standards` G-check (resolved-epic-with-open-children) immediately errored: 3 more children (#823/#824/#870) had been parented after the body was written and were still open/active. I reverted `resolved → open` and appended a current-state section. Resolve-then-revert is avoidable churn.

**How to apply:** Before resolving any `workItem: epic`, run `grep -l '^parent: "<NNN>"' backlog/*.md` (or equivalent) and confirm EVERY match is `status: resolved` — the no-open-slice guard is over edges, not prose. The gate is the deterministic backstop (it errored, correctly), but don't lean on resolve-then-revert; check first. Same trap is live on #317/#318. Related: [[feedback_backlog_closeout_resolve_not_delete]], [[feedback_misflagged_batchable_fix_real_state]].
