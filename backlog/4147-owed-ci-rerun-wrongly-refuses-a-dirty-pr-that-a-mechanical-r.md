---
bornAs: xudx8ff
kind: task
parent: "4075"
status: open
scope: ["we:scripts/conveyor/reconcile-core.mjs", "we:scripts/conveyor/__tests__/reconcile-core.test.mjs"]
dateOpened: "2026-09-25"
tags: []
---

# owed-ci-rerun wrongly refuses a DIRTY PR that a mechanical rebase can never fix

we:scripts/conveyor/reconcile-core.mjs's ci-red branch refuses owed-ci-rerun (deferring to we:scripts/conveyor/ci-red-recovery-watch.mjs's mechanical no-checkout rebase) whenever we:scripts/conveyor/main-red-recovery.mjs#isPrCiFailureOwedRerun says the required check failed inside one of main's own red windows -- with no check for whether the PR itself is mergeStateStatus DIRTY (a real conflict with main). Live incident 2026-09-25: PRs #2635 and #2636 are both owed-ci-rerun AND DIRTY/CONFLICTING (confirmed via gh pr view --json mergeStateStatus,mergeable), so they were refused forever -- a mechanical rebase can never resolve a real conflict, and the refusal pre-empted the only path that could (ci-heal, which rebases or merges main and fixes). we:scripts/conveyor/ci-red-recovery-watch.mjs is also not installed as any launchd job (checked: launchctl list has no matching entry), so nothing even attempts the mechanical rebase today. Fixed by skipping owed-ci-rerun for a DIRTY PR (reading pr.mergeStateStatus, the same field classifyPr already reads for its own conflicted phase) so it falls through to the ordinary ci-heal cap-check/dispatch instead.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
