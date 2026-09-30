---
kind: story
locus: plateau-app
size: 5
status: open
blockedBy: ["xr8m6gs", "4281"]
scope: ["plateau-app:src/wip/progress-delivery.ts", "plateau-app:src/wip/progress-delivery.test.ts", "plateau-app:src/wip/progress-history.ts", "plateau-app:src/wip/progress-history.test.ts", "plateau-app:src/wip/progress-read.ts", "plateau-app:src/wip/wip-view.ts", "plateau-app:src/wip/wip-view.test.ts"]
dateOpened: "2026-09-30"
tags: []
---

# Count confirmed deliveries by kind and show durable progress trends

Publish confirmed merged-today counts for builder builds, card plans, prevention cards and tool fixes, with provenance and comparable hourly and seven-day trends. Full design: we:docs/agent/plateau-progress-view.md.
## Design

Follow we:docs/agent/plateau-progress-view.md. WE owns the declarative wire contract and examples; Plateau owns adapters, aggregation, relay and UI. Keep the existing publisher/relay, 120-second baseline, source ages and explicit unknown/partial states. No display-driven GitHub calls. One plain description per row, fully wrapped, never ellipsis. System-owned failures remain flow state.

## MVP

Add proposed Plateau delivery/history adapters named in scope. Join event-ledger merges and local drain evidence by repo/PR; distinguish real mergedAt from observation time. Retain at least eight local calendar days across publisher restart. Classification follows explicit metadata and the design precedence; retain other/unclassified and separate origin from delivery kind. Add a per-source backfill/completeness contract with the existing producer, not a second GitHub poller. Complete all-author merged coverage depends on #4281 and its reconciliation/backfill; if its shipped contract lacks merge history, shape a producer follow-up before queueing this story.

## Done when

1. Four requested kind counts plus other/unclassified reconcile to total unique merged PRs; completed sessions and resolved cards never inflate merges.
2. Duplicate drain/webhook records and same-number cross-repo PRs are counted correctly; ambiguous historical classification remains unknown.
3. Today uses America/Toronto midnight including DST; trailing-hour comparison uses equal coverage and seven-day buckets display gaps.
4. Publisher restart preserves history; offline/missing baseline shows unknown rather than a false zero or slowdown.

## Test and proof

Use merge fixtures for duplicates, mixed kinds, reclassification, midnight/DST, history truncation and changing repo coverage. Run adapter/history/view tests, replay real redacted drain and event records, and reconcile rendered totals against their exact union. Record API ledger deltas proving no collector-owned GitHub backfill.

## Readiness and follow-ups

Filed with `--queue=false`: design reviewed by the operator and producer seams proven during preparation before scheduling. No prepared stamp is claimed. Scope lists predicted files, including new adapters and tests; revise it during preparation if an existing producer needs a separate change. Record testing lessons and uncovered producer gaps here, not in shared agent docs.
