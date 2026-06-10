---
description: Analyse large backlog stories (size > 5) and split the safe ones into smaller batchable items (routes to the split-backlog-item skill)
---

Invoke the `split-backlog-item` skill to analyse large backlog stories (`workItem: story`, `size` > 5)
and break each into smaller, agent-ready, independently-deliverable, batchable slices — **only when
it's provably safe and does not cost quality**. Apply the split-safety rubric (size is volume not an
unresolved decision · ≥2 nameable slices each with a real home · each slice lands `size` ≤ 3 / `task` ·
a clean DAG with real independence or incremental delivery · every slice leaves a valid demoable state).
Always write the report `reports/<date>-backlog-split-analysis.md` listing **could split** (proposed
slices + DAG) and **could not split** (which condition failed + the action that would unblock a future
split) — even when nothing splits. Present the proposed splits and get **one "go"** before mutating the
backlog; never auto-split. On approval, convert each original in place to a storied epic and scaffold
the slices (`node scripts/backlog.mjs scaffold … --parent=<NNN> --blocked-by=…`), gating on
`npm run check:standards`.

A bare `/split` sweeps the whole candidate set and reports. A `NNN` or `NNN-slug` focuses one item.

$ARGUMENTS
