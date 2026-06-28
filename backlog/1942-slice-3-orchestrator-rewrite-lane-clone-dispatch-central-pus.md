---
kind: story
size: 8
parent: "1933"
status: open
dateOpened: "2026-06-28"
tags: []
---

# Slice 3: orchestrator rewrite — lane-clone dispatch + central push/merge/rebase-retry

Replace the worktree-isolation orchestrator (we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js) with the #1933 clone-based model. Per item: pick a lane from the pool (we:scripts/lane-pool.mjs, slice 2), dispatch the item agent into that lane clone, gate locally, commit explicit paths, push HEAD:lane/<slug>-<n> (#1934 carve-out). Central integrator (primary checkout): fetch lane/*, merge each into main one-at-a-time with a full check:standards per merge, rebase-and-retry on conflict (never force), delete the remote temp branch, regenerate derived artifacts (we:AGENTS.md, referenceIndex) once at the end. Claims are pre-assigned centrally — lanes never touch the central we:.claude/skills/batch-backlog-items/claims.json (#1933 choice 2). Reuses the #1869 ledger reconcile; multiLaneFiles detection runs against the assembled tree.
