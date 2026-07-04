---
name: project_memory_management_policy
description: How to manage agent memory so the always-loaded index stays bounded — the canonical policy is the repo doc; this is the pointer
metadata: 
  node_type: memory
  type: project
  originSessionId: c11fff23-8609-4cda-ada8-1f02bacf96e9
---

The agent memory system is governed by a **codified policy** (backlog #1517, tree amend #1868): the
canonical home is the repo doc **`docs/agent/memory-management.md`** — read it for the full rules. Summary:

- **The index is a TREE (3 tiers):** `MEMORY.md` (always-loaded) is now a **category map** + a small
  **core-invariants** block — NOT a flat list. Each map line links a recall-gated `index-<category>.md`
  **sub-index** (tier 2), whose lines are bare `- N. Title — hook`; the `N` resolves to a leaf file
  `N-slug.md` (tier 3) via `node scripts/memory-resolve.mjs <N>` (or `--cat`). Reachability is
  explicit-read from the always-loaded map (the router pattern), not `description` auto-recall (#1868).
- **Budget (enforced):** `MEMORY.md` **≤ 22 KB**, each line **≤ 200 chars**. The map links **only**
  `index-*.md` sub-indexes (a leaf link there is denied — it would regrow the always-loaded surface);
  every leaf must be reachable from MEMORY.md or a sub-index. Run `npm run check:memory`; a `PreToolUse`
  hook denies an over-budget `MEMORY.md` write (the #883 pattern — see [[project_enforce_shared_gate_at_write_time]]).
- **Add a rule:** create `<next-N>-slug.md`, add a `- N. Title — hook` line to its **sub-index** (not
  MEMORY.md). Promote to the core-invariants block only if load-bearing enough to be always-loaded.
- **Right-home (the structural cap):** project-architecture invariants belong in
  `docs/agent/platform-decisions.md` + `AGENTS.md`, **not** memory. Memory holds personal/working
  preferences (`feedback_*`) + a small core-invariants set. Before saving a `project_*` memory, ask
  whether it belongs in `platform-decisions.md` instead.
- **One canonical file per idea** (consolidate clusters, prune superseded); **merge-before-add** when at
  budget.

This itself follows the policy: a process rule, kept as a thin pointer to the repo doc rather than a fat
memory. Relates to [[project_we_zero_standard_implementation]] (same right-home discipline: rules → repo
canon).
