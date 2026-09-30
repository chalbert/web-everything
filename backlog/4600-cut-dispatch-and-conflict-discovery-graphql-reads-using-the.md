---
bornAs: xe3xtio
kind: story
size: 5
status: open
blockedBy: ["4281", "4282"]
scope: ["we:scripts/readiness/dispatch-plan.mjs", "we:scripts/conveyor/parked-pr-conflict-watch.mjs", "we:scripts/lib/pr-snapshot.mjs", "we:scripts/readiness/already-done-cache.mjs"]
dateOpened: "2026-09-30"
relatedTo: ["4283", "4075"]
tags: [review-ledger, product-design]
---

# Cut dispatch and conflict discovery GraphQL reads using the shared PR ledger

Extend the existing webhook PR-state slices to the measured dispatch-plan and parked-conflict readers. Preserve live mutation gates and bounded reconciliation. Measure at least 60 percent fewer GraphQL points in the selected caller buckets over matched six-hour windows. Design: we:docs/agent/review-state-ledger-target.md. This is a discovery-only MVP; no review-authority flip.

## Scope and relationship

This is the additional high-spend consumer slice after #4281 and #4282, not a duplicate implementation of their feed/projector. Read the target and frozen baseline in we:docs/agent/review-state-ledger-target.md. Existing consumers: we:scripts/readiness/dispatch-plan.mjs and we:scripts/conveyor/parked-pr-conflict-watch.mjs, using we:scripts/lib/pr-snapshot.mjs. The already-done checker is reached through we:scripts/operations/dispatch-lane-io.mjs; preserve its decision semantics and historical coverage, not just the open PR list.

Implement reusable new runtime in Frontier UI, served/credential-holding portions in Plateau; prepare exact physical files and contract data before build. The listed WE scope identifies existing compatibility consumers. Preparation must add the actual FUI/product/test files once located, rather than inventing paths in this design. No merge-authority change is part of this story; no new database is required beyond #4281's existing webhook store.

## Required behavior

Use complete per-repo event-derived views for dispatch discovery and parked-conflict scheduling. For already-done lookups, retain/index closed and merged PR associations and explicitly track historical coverage; an empty open-PR snapshot cannot prove an item was never merged. Bootstrap and bounded shared reconciliation fill unknowns. Preserve live per-PR mutation gates and decline to infer eligibility from stale or incomplete observations.

Expose fallback reason, freshness, selected caller points and read purpose. One budgeted reconciler owns refresh; a stale feed must not launch one host poll per daemon. Add a consumer rollback flag. Current label/coverage/CI gate behavior remains in force.

## Done when

1. Replays exercise duplicate/out-of-order events, a missed event and cursor reset, empty check PR arrays, a head change, human label edits, merged history and incomplete bootstrap. Assert the same dispatch/hold result as the existing authoritative read on complete inputs and a safe fallback/hold on incomplete inputs. Cover all newly added standard features with shared fixtures and their conformance demo.
2. Run affected integration/unit checks, the repository standards gate, and a real daemon canary. The proof is running consumers with captured external facts, not only pure tests; record commands, inputs, rollback observation and outputs on this card at implementation.
3. Compare matched six-hour windows using `node we:scripts/lib/gh-spend.mjs report --hours=6 --by=caller+op` (strip the locus when invoking). Baseline selected GraphQL buckets: dispatch-plan list 5,007, dispatch-plan snapshot 901, parked-conflict snapshot 3,119 = **9,027 points**. Require **at least 60% less selected-bucket spend** at comparable PR/tick activity, about **903 points/hour** saved at this baseline; report total App spend and unattributed traffic separately.
4. No REST fallback storm, duplicate dispatch, missed eligible work, or latency regression beyond the configured reconciliation bound. Retain live pre-mutation verification. If merged-history coverage cannot support the selected bucket, report that miss and do not claim the target achieved.

Filed with queue disabled for operator design review. This MVP is independent of the new product storage/authority decisions, but depends on the existing discovery substrate stories. It does not alone promise to bring total spend below 5,000 points/hour.
