---
bornAs: xd9xwtn
kind: task
status: resolved
scope: ["we:scripts/operations/graduation-progress-report.mjs", "we:scripts/operations/graduation-progress-report-io.mjs", "we:scripts/operations/run.mjs"]
dateOpened: "2026-09-15"
dateStarted: "2026-09-15"
dateResolved: "2026-09-15"
graduatedTo: "we:scripts/operations/graduation-progress-report.mjs"
tags: []
---

# Add graduation-progress-report operation for session-delegation trials (backlog #3690)

A declared read-only operation (we:scripts/operations/graduation-progress-report.mjs, invoked via we:scripts/operations/run.mjs) that reads we:scripts/conveyor/run-scorecards.json via we:scripts/conveyor/run-scorecard-store.mjs and reports, per {provider, model, taskType} with any session-delegation trial history: trials so far, trailing clean streak toward the N=5 progressive-backdown threshold from backlog #3690, whether the informative-trial requirement is met, current verification tier (full vs spot-check), and any calibration-miss resets. Mirrors we:scripts/operations/gate-health.mjs (compute-only steps, no sink).

## Done when

1. **Executable** — `node we:scripts/operations/run.mjs graduation-progress-report --json` runs against the
   real store and reports, per `{provider, model, taskType}`, trials so far, trailing clean streak, the
   informative-trial flag, `qualifies`, `verificationTier` (`full`/`spot-check`) and any calibration-miss
   `resets` (fails today: the operation does not exist before this lands).
2. **Registered** — the operation is wired into `we:scripts/operations/run.mjs`'s `OPERATIONS` table
   (compute-only, no sink, same read-only shape as `we:scripts/operations/gate-health.mjs`).
3. **Tested** — `we:scripts/operations/__tests__/graduation-progress-report.test.mjs` proves registration,
   the pure aggregation arithmetic against the real 9 current session-delegation rows (matching backlog
   #3690's own worked table: all 5 triples on `full` tier, `codex/gpt-6-astra/bugfix`'s streak reset by its
   two hardening-round findings), the trust-never-transfers-across-a-triple rule, the calibration-miss veto,
   and the informative-trial requirement — all green.
4. **Clean gate** — `npm run check:standards` reports 0 new errors.
