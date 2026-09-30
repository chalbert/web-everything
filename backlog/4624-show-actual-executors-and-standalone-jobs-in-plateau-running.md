---
bornAs: xvmk4h4
kind: story
locus: plateau-app
size: 5
status: open
blockedBy: ["4620", "4340"]
scope: ["plateau-app:src/wip/progress-runs.ts", "plateau-app:src/wip/progress-runs.test.ts", "plateau-app:src/wip/progress-read.ts", "plateau-app:src/wip/wip-view.ts", "plateau-app:src/wip/wip-view.test.ts", "plateau-app:scripts/wip-publish.ts"]
dateOpened: "2026-09-30"
tags: []
---

# Show every running job and builder hold with its actual owner and executor

Join builder builds and preparing, standalone Codex/agy workers, fix/ci-heal and review jobs into honest moving and held counts with model provenance. Full design: we:docs/agent/plateau-progress-view.md.
## Design

Follow we:docs/agent/plateau-progress-view.md. WE owns the declarative wire contract and examples; Plateau owns adapters, aggregation, relay and UI. Keep the existing publisher/relay, 120-second baseline, source ages and explicit unknown/partial states. No display-driven GitHub calls. One plain description per row, fully wrapped, never ellipsis. System-owned failures remain flow state.

## MVP

Add proposed plateau-app:src/wip/progress-runs.ts using existing agent-activity, claim/hold, fix-claim and tick sources. Probe actual standalone launcher records during preparation; declare coverage partial until both Codex and agy are observed. Show actual supervisor/executor/model separately, never inferred from a session name. Preserve logical work versus child jobs. Read persisted holds AND tick refusals; display scope overlap counterpart, needs-prepare owner and critical-to-Claude usage/limit with age. Missing handler becomes an owned or unassigned system incident, not a user chore.

## Done when

1. Build, prepare, standalone Codex, standalone agy, fix and ci-heal each appear with evidence-backed role/origin/model or explicit unknown.
2. Supervisor plus delegated child counts one work item and two jobs; duplicate registry records do not inflate either.
3. Overlap, preparation and Claude-cap fixtures show distinct reasons, age, owner and next system step.
4. Finished/dead jobs do not count as moving; waiting/stale jobs remain visible.

## Test and proof

Add fixtures and focused adapter/view tests for parent joins, PID reuse, missing models, stale holds and jobs outside Claude listings. Observe one real record from each producer and replay redacted snapshots through the existing relay. Do not launch paid jobs only to test display. Confirm a stale claim cannot manufacture a live build.

## Readiness and follow-ups

Filed with `--queue=false`: design reviewed by the operator and producer seams proven during preparation before scheduling. No prepared stamp is claimed. Scope lists predicted files, including new adapters and tests; revise it during preparation if an existing producer needs a separate change. Record testing lessons and uncovered producer gaps here, not in shared agent docs.

Existing prerequisite #4340 supplies the daemon panel and dispatch-log holds; extend those observations rather than add a competing panel.
