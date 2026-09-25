---
kind: story
size: 3
parent: "4075"
status: active
scope: ["we:scripts/conveyor/reconcile-core.mjs", "we:scripts/conveyor/session-reaper.mjs", "we:scripts/conveyor/__tests__/reconcile-core.test.mjs", "we:scripts/conveyor/__tests__/session-reaper.test.mjs"]
dateOpened: "2026-09-25"
dateStarted: "2026-09-25"
tags: []
---

# Review loops: infra cool-off, zero-findings round cap, one-review-per-head

Three review-loop bugs in the reconcile/session-reaper pipeline (epic #3383/#4075 Phase 1 'review loops'): (a) we:scripts/conveyor/session-reaper.mjs#makeCompletionResolver reaps a session reporting blocked-on-infra immediately, ignoring we:scripts/conveyor/reconcile-core.mjs's own INFRA_RETRY_COOLOFF_MS, so a PR is re-dispatched ~2 min later instead of waiting out the cool-off; (b) we:scripts/conveyor/reconcile-core.mjs's zero-findings review-dispatch branch hardcodes attempts:0, so it never hits the round cap and re-dispatches forever; (c)/(d) nothing enforces one review per head commit, so a PR can be re-reviewed after its current head already carries an accept verdict (live: chalbert/web-everything#2588, review:changes at 23:55:40Z and review:accepted at 00:00:46Z on the SAME head). Fix: session-reaper's completionFor now respects the cool-off; reconcile-core's zero-findings branch uses the real durable attempt count and a new already-reviewed-head refusal (via we:scripts/lib/review-escalation.mjs#parseReviewedSha) blocks re-dispatch on an already-accepted head. Proof: vitest red/green on we:scripts/conveyor/__tests__/session-reaper.test.mjs and we:scripts/conveyor/__tests__/reconcile-core.test.mjs; a live read-only runReconcilePass before/after; a replay of #2588's real GitHub comment history.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
