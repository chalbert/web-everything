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

## First real multi-lane run — 2026-06-19

Ran a 26-item parallel batch (`batch-2026-06-19-1148-1123`): **20 resolved / 61 pts**, landed clean — `multiLaneFiles` empty, 1 lane conflict replayed serially, derived regenerated once, landed tree gate green. Three problems found and fixed in commit `663df88`:

1. **Probe partition over-conservative** — only **1 parallel lane formed; 20/26 items serialized**. Not real collisions: the probe's "false if at all unsure" confidence bar pushed ~16/26 to the serial lane despite disjoint touch-sets (e.g. the four conformance demos, each its own `we:demos/*.ts`). Fixed: recalibrated the bar — own files → `confident:true`; only genuine shared-surface risk → false; per-entry registry writes explicit-disjoint.
2. **Integrate phase switched the shared checkout** (`git switch -c <integrationBranch>`) instead of an isolated worktree, stranding the user on the throwaway branch — the opposite of the #1147 "never writes the live branch" promise. Fixed: integration now runs in a dedicated `git worktree add` worktree; the live checkout is never touched.
3. **Calibration was being run for parallel batches**, but a context-% reading is meaningless there (subagents do the work, so the orchestrator's context% is decoupled from points resolved). Fixed: calibration is now **serial `/batch` only**; `/workflow` skips it.

Also surfaced (handled separately): the batch **auto-ratified** decisions #1103/#1121/#1136 off the `preparedDate`/"ready" signal — #1103 was reopened+properly re-ratified, #1121/#1136 reviewed and left ratified. And #1157 was filed to finish the per-entry registry split so fewer items hit the serial lane.

**Verdict: keep the parallel default — but the three fixes are themselves UNVALIDATED.** A **second** real `/workflow` run is needed to confirm the recalibrated probe forms multiple concurrent lanes and the worktree-integration lands without touching the live checkout. Keep this item **open** until that second run's close audit passes.
