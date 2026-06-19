---
type: idea
workItem: story
size: 3
parent: "1143"
status: open
dateOpened: "2026-06-19"
tags: []
---

# Live-validate the parallel /workflow batch orchestrator over its first real runs

Parallel batching is opt-in via `/workflow` (`/batch` stays linear/serial), re-split from #1147's default-on so the choice is explicit per invocation. The orchestrator (we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js) is now **per-item**: each independent item runs alone in its own worktree (concurrent, per-item `/workflows` progress); entangled/uncertain/monolith items run one-at-a-time in a serial lane. Structurally verified, NOT yet proven live. The agreed WATCH over the first real `/workflow` runs that spawn ≥1 concurrent item: confirm via the close audit that the partition, per-item gating, one-at-a-time integration, conflict→serial-replay, the single landing merge, and once-only derived regen all behave. Epic #1143 stays open until this settles.

## What to confirm over the first real runs

Over the first `/workflow` runs that actually split off ≥1 concurrent item, the close audit confirms:
- probe + partition pick the **correct concurrent set** (each item pairwise-disjoint; entangled/uncertain/monolith → serial lane);
- each concurrent item **gates green locally** in its own worktree;
- the integrator works the **serial lane first**, then merges each worktree **one-at-a-time** onto the throwaway integration branch with a **full gate per merge**;
- an overlapping pair triggers **conflict→serial-replay** (never a force-merge);
- the main agent **lands the integration branch in ONE merge**;
- `multiLaneFiles` is **empty-or-eyeballed**; derived artifacts (we:AGENTS.md / we:src/_data/referenceIndex.json) **regenerate exactly once**.

Heavy replay (most concurrent items falling back) or a wrong multi-item merge is the reevaluation signal → narrow `/workflow` and record why.

**Lineage:** #1147 made parallel the `/batch` default; this session re-split it into a dedicated `/workflow` command (linear `/batch` kept) and refactored the orchestrator from multi-item lanes to one-agent-per-item (per-item progress + a cleaner pairwise-disjoint partition). The "flip back to opt-in" escape this item always reserved is now the standing shape, not a failure trigger.
