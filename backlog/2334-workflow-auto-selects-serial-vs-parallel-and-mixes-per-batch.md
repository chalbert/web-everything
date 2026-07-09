---
kind: story
size: 8
parent: "1143"
status: resolved
dateOpened: "2026-07-08"
dateStarted: "2026-07-09"
dateResolved: "2026-07-09"
tags: []
---

# /workflow auto-selects serial vs parallel (and mixes) per batch, adapting as it progresses

Today the execute model is a manual per-invocation choice: /batch is serial, /workflow is parallel. The orchestrator should instead DECIDE the model from the pack's real shape and ADAPT as the batch runs — provably-disjoint items go parallel, items sharing a touch-set (e.g. several PRs all editing the drain/review core: we:scripts/merge-ai-prs.mjs, we:scripts/pr-land.mjs, we:scripts/lib/review-escalation.mjs) run serially, and the partition re-evaluates as items land and free/contend files. Degenerates to all-serial when nothing is disjoint (correct) and all-parallel when everything is. Goal: the user picks 'batch', not 'which engine'. Surfaced 2026-07-08 in batch-2026-07-07-1821-2325, where 9 lane/PR/review-infra items shared the drain core and were run serially by hand; the user asked for exactly this adaptive/mixed model.

## Progress

Delivered the pure, tested heart of the adaptive selector — `we:scripts/readiness/batch-schedule.mjs` (proved by `we:scripts/readiness/__tests__/batch-schedule.test.mjs`, 20 cases):

- `selectModel(entries)` → `all-parallel | all-serial | mixed`, auto-chosen from the pack's real shape (the user picks 'batch', not the engine).
- `scheduleWaves(entries)` → the mixed plan as ordered dispatch waves: disjoint items fan out in wave 0, contending items chain into later waves.
- `readyAfter(entries, landed)` → the ADAPTIVE re-evaluation — a pending item frees up the moment every contention-predecessor has landed, so the plan adapts as items land and free/contend files.
- `contends()` is the EFFICIENCY predicate (any real touch-set overlap ⇒ chain, sparing the drain a rebase-replay per collision) — a documented superset of the `we:scripts/readiness/lane-partition.mjs` `conflicts()` CORRECTNESS predicate; the two reuse the same primitives so they never drift.
- Degenerates correctly: nothing contends ⇒ one wave (`all-parallel`); a full mutual-contention clique ⇒ N one-item waves (`all-serial`). The 9-drain-core-item hand-serialisation case now schedules as a 9-deep chain automatically (headline test).

FOLLOW-UP (needs a decision, not a unilateral batch edit): wiring this into the live `we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js` STACKS a chained lane's PR onto its predecessor's HEAD instead of origin/main — a real behavior change that partially reverses the #2183 "no probe→partition, git is the arbiter" stance (F2 DROP, ratified 2026-07-03). That reversal should be decided (per Rule #39), then the sandbox orchestrator inline-mirrors these pure functions the way it already mirrors `we:scripts/readiness/lane-partition.mjs`.
