---
type: idea
workItem: story
size: 3
parent: "1143"
blockedBy: ["1159"]
status: open
dateOpened: "2026-06-19"
dateStarted: "2026-06-20"
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

## Second real multi-lane run — 2026-06-19 (`batch-2026-06-19-parallel-1149`)

Ran a 20-item parallel batch (77-pt budget): **17 resolved / 2 carried (#1013 outgrew, #1137) / 1 dropped (#1030 blocked-in-fact)**. Partition **7 concurrent / 13 serial**; **4 multiLaneFiles** (`we:vitest.config.ts`, `we:src/_data/projects.json`, `we:contracts/package.json`, `we:AGENTS.md`) — all eyeballed clean (e.g. #1156's webtraces/webevents `concept→poc` flip survived #1157's `we:src/_data/projects.json`→per-entry split). Derived artifacts regenerated once. Landed-tree gate **0 errors**.

**Fixes from `663df88` — validation result:**
- ✅ **Fix #2 (isolated-worktree integrate)** — confirmed: integration ran in `.claude/worktrees/integrate-2026-06-19-parallel-1149`; the live checkout was never switched. The single landing merge is the main agent's only write to the live branch.
- ✅ **Fix #3 (calibration serial-only)** — confirmed: `/workflow` skipped calibration; no meaningless context-% ask.
- ⚠️ **Fix #1 (probe recalibration)** — *partially*. Multiple concurrent lanes now form (7, up from 1/26), so the over-conservative bar is fixed. BUT a **new signal**: **4 of the 7 concurrent items gate-RED'd in their own worktree** (#1071, #1139, #1058 red; #1137 no-clean-land) and recovered only via **serial replay** on the integrated tree — where all 4 then gated green. That is the **"heavy replay / most concurrent items falling back"** reevaluation signal this item names. Likely cause: a concurrent worktree branches from base and lacks the *other* items' changes, so any **cross-item / global-consistency** portion of `npm run check:standards -- --local` fails in isolation (e.g. registry/referenceIndex coherence absent #1157) — a false-red that the integrated replay clears. The conflict→serial-replay safety net **worked** (no force-merge, nothing lost), but the concurrent speed-win is largely eaten by the replay.

**New bug found + fixed this run:** the orchestrator read `args.items` directly, but the Workflow runtime delivered `args` as a **JSON string** in this environment → two 5ms no-op runs ("No packed items passed") before the real run. Fixed: `args` is now `JSON.parse`d when it's a string (top of `we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js`).

**Landing friction (not an orchestrator bug):** the first `git merge --no-ff` aborted on a dirty tree (the uncommitted arg-fix + a pre-existing dirty `we:audits/backlog-health-audit.md`), and the chained `git branch -D` ran before the merge succeeded — recovered from the commit sha, no loss. Close-out should clean/commit the workflow-file fix before landing.

**Verdict: do NOT settle yet — fix #1's red-in-worktree fallback is the open follow-up.** Fixes #2/#3 are validated. The next investigation: make the concurrent worktree's local gate **context-aware** (scope it to the item's own files / skip global-consistency checks that can't pass in isolation) so genuinely-independent items don't false-red into serial replay. Keep this item **open** (and #1143) until that lands and a third run shows concurrent items gating green in-worktree.

## Blocked-in-fact (batch-2026-06-19-1150-1141 serial close-out)

The fix-#1 follow-up above is carved to **#1159** (scope `check:standards --local --files` to skip global-consistency rules in isolation), which is still `open` — added `blockedBy: 1159`. A meaningful **third** `/workflow` run only makes sense AFTER #1159 lands (else the same false-red fallback recurs). Also: this item's acceptance is a *parallel `/workflow` run + close audit*, which a **serial `/batch`** session cannot perform (wrong tool; a parallel batch needs its own session and the closing-session skill audits it). So it cannot be resolved from a serial lane — released back to `open`, correctly blocked on #1159.
