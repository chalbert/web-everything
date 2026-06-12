---
description: Slice an unsliced epic (or split a large story) into smaller batchable items — alias of /split (routes to the split-backlog-item skill)
---

Alias of `/split` — invoke the `split-backlog-item` skill. Slicing takes either an **unsliced epic**
(`workItem: epic` with no children — already decided to decompose, slices proposed straight from its
body) **or a large story** (`workItem: story`, `size` > 8) and breaks it into smaller, agent-ready,
independently-deliverable, batchable slices — **only when it's provably safe and does not cost
quality**. Apply the split-safety rubric (for an epic, condition (1) "size is volume not a fork" is
already settled at the parent level, but every slice still must satisfy the rest, and no slice may bury
its own fork · ≥2 nameable slices each with a real home · each slice lands `size` ≤ 3 / `task` · a clean
DAG with real independence or incremental delivery · every slice leaves a valid demoable state). Always
write the report `reports/<date>-backlog-split-analysis.md` listing **could split** (proposed slices +
DAG) and **could not split** (which condition failed + the unblocking action) — even when nothing
splits. Present the proposed slices and get **one "go"** before mutating the backlog; never auto-split.
On approval, scaffold the slices under the epic/story (`node scripts/backlog.mjs scaffold …
--parent=<NNN> --blocked-by=…`) — converting a story to a storied epic first, or leaving an already-epic
in place — gating on `npm run check:standards`.

A bare `/slice` sweeps the whole candidate set and reports. A `NNN` or `NNN-slug` focuses one item.

$ARGUMENTS
