---
kind: task
status: active
scope: ["we:scripts/progress-board.mjs", "we:scripts/operations/pr-status.mjs", "we:scripts/readiness/conveyor-state.mjs"]
scaffoldedBy: "investigate-15-stuck-prs"
dateScaffolded: "2026-09-05"
dateOpened: "2026-09-05"
tags: [conveyor, review, dispatch]
---

# classifyPr's ci-red check fires on review-gate's own by-design pre-review failure, permanently blocking review dispatch

classifyPr (we:scripts/progress-board.mjs) checks ciFailed(statusCheckRollup) BEFORE checking the review:pending label, and ciFailed treats ANY failing check by name -- including review-gate, whose whole job (we:.github/workflows/review-gate.yml + we:scripts/check-review-gate.mjs) is to report FAILURE until an independent review completes. Confirmed live 2026-09-05: all 10 open review:pending PRs (1928,1929,1930,1931,1932,1933,1935,1936,1937,1939) show test/smoke/test-shard all green and ONLY review-gate red (verified via gh pr checks), yet we:scripts/conveyor/reconcile-pass.mjs classifies every one ci-red via classifyPr and refuses to dispatch a review (owed-elsewhere/ci-heal), which never fires either since nothing is actually broken. This is a total self-referential deadlock: review-gate can only turn green once reviewed, but ci-red masks needs-review so a review is never dispatched. Fix: exclude the review-gate check by name from ciFailed's rollup scan in classifyPr's ci-red branch, and check reduceCheckState in we:scripts/operations/pr-status.mjs for the same class of issue re ci-heal targeting, so a PR whose ONLY failing check is review-gate reads as needs-review not ci-red. Add a regression test reproducing this exact rollup shape (test/smoke/test-shard green, review-gate failure) asserting classifyPr returns needs-review not ci-red when review:pending is set.

## Done when

1. **Executable** — a new unit test in `we:scripts/__tests__/progress-board.test.mjs` (or sibling) reproducing
   the exact live rollup shape (`test`/`smoke`/`test-shard` all `SUCCESS`, `review-gate` `FAILURE`) with
   `review:pending` in labels, asserting `classifyPr(...)` returns `'needs-review'`, not `'ci-red'` — fails
   before this item's fix lands, passes after.
2. `ciFailed` (or a wrapper `classifyPr` uses) excludes the `review-gate` check by name from the rollup scan
   it uses to decide `ci-red` — a real broken required check (any name other than `review-gate`) still reads
   `ci-red` exactly as today.
3. `we:scripts/operations/pr-status.mjs`'s `reduceCheckState` is checked for the same class of issue (used by
   `we:scripts/conveyor/reconcile-core.mjs` for CI truth and by `we:scripts/conveyor/tick-core.mjs`'s ci-heal
   targeting) — fixed the same way if it is independently affected, or noted why it is not, with evidence.
4. No regression in the existing `classifyPr`/`ciFailed`/`reduceCheckState` unit tests.
