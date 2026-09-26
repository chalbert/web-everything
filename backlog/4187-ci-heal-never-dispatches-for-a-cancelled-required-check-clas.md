---
bornAs: xznd5za
kind: story
size: 2
parent: "4075"
status: open
scope: ["we:scripts/progress-board.mjs", "we:scripts/conveyor/reconcile-core.mjs", "we:scripts/__tests__/progress-board.test.mjs", "we:scripts/conveyor/__tests__/reconcile-core.test.mjs"]
dateOpened: "2026-09-25"
tags: []
---

# ci-heal never dispatches for a CANCELLED required check — classifyPr's ciFailed misses CANCELLED

LIVE 2026-09-25 PR #2636 (chalbert/web-everything): required check test-shard(1) concluded CANCELLED (daemon's own hung-ci-recovery cancel, cap-exhausted at cancelled-no-rerun). we:scripts/progress-board.mjs#ciFailed only treats FAILURE/TIMED_OUT/ACTION_REQUIRED/STARTUP_FAILURE as failing, so classifyPr never returns ci-red and we:scripts/conveyor/reconcile-core.mjs's ci-heal branch (gated only on classifyPr's phase) is skipped, falling through to nothing-owed — even though we:scripts/operations/pr-status.mjs#FAILING_CONCLUSIONS and we:scripts/merge-ai-prs.mjs#isRequiredCheckFailed both already treat cancelled as failing. Fix: single-source ciFailed off FAILING_CONCLUSIONS, and add a visible cap-exhausted escalation note in we:scripts/conveyor/reconcile-core.mjs's ci-red branch so a capped PR is never left silently at nothing-owed.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
