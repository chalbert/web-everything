---
bornAs: x34h6a2
kind: story
size: 3
status: resolved
scope: ["we:scripts/lib/model-probation.mjs"]
dateOpened: "2026-09-27"
dateStarted: "2026-09-28"
dateResolved: "2026-09-28"
tags: []
---

# Turn a probation run into a judged trial once its review lands

Probation runs already write a scorecard row (executor=antigravity|codex) via we:scripts/lib/probation-launcher.mjs, but nothing converts that row into a judged trial in we:scripts/lib/model-probation.mjs once the PR's review verdict lands -- so we:scripts/lib/model-probation.mjs's report command only grows when someone records a trial by hand. Automate the conversion: when a probation-executed PR's review verdict lands, record a trial (landed / reworked / rejected, plus the critical-miss flag) against the provider x model x task-type triple in we:scripts/lib/model-probation.mjs, the same graduation-progress ledger the report reads. Note: the report's run-rating criterion needs PR #2811 to land first (it reads not-measured/unmet until then). Why: the operator wants other models to earn more of the real work over time as trial data supports it; promotion out of probation stays an explicit human decision, never automatic.

## Done when

1. **Executable** — `npx vitest run we:scripts/lib/__tests__/model-probation-trials.test.mjs` (fails before: the conversion does not exist; passes after).

## Progress

- we:scripts/lib/model-probation.mjs: `pendingProbationLaunches` (pushed heals with a PR and no trial yet), `trialOutcomeFromPr` (merged → landed, closed → rejected, open + `review:changes` → reworked, else wait), `judgedTrialRow` (a `probation-trial.1` row, `verifiedBy: independent-claude`, `informative: false` never inferred, PR changed files as `filesTouched`, `criticalMiss` stamped via we:scripts/lib/critical-work.mjs `isCriticalMiss`), and the idempotent `judgePendingTrials` sweep. A failed PR lookup leaves the launch pending.
- New CLI: `node we:scripts/lib/model-probation.mjs judge [--dry-run] [--store=<path>]` reads each pending PR via `gh` and appends trial rows to the shared scorecard store. It never writes the registry, so promotion stays a human decision.
- The report's `launched … awaiting review` count now leaves out launches that already have a judged trial.
- Test: we:scripts/lib/__tests__/model-probation-trials.test.mjs goes launcher row → real store (temp file) → sweep → `graduationProgress`.
- Follow-on (outside this scope): nothing calls `judge` on a schedule yet. It needs a trigger, e.g. a daemon tick or a hook after a `review:changes` or merge.
