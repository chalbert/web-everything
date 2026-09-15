---
kind: task
status: active
scope: ["we:scripts/operations/graduation-progress-report.mjs", "we:scripts/operations/graduation-progress-report-io.mjs", "we:scripts/operations/run.mjs"]
dateOpened: "2026-09-15"
dateStarted: "2026-09-15"
tags: []
---

# Add graduation-progress-report operation for session-delegation trials (backlog #3690)

A declared read-only operation (we:scripts/operations/graduation-progress-report.mjs, invoked via we:scripts/operations/run.mjs) that reads we:scripts/conveyor/run-scorecards.json via we:scripts/conveyor/run-scorecard-store.mjs and reports, per {provider, model, taskType} with any session-delegation trial history: trials so far, trailing clean streak toward the N=5 progressive-backdown threshold from backlog #3690, whether the informative-trial requirement is met, current verification tier (full vs spot-check), and any calibration-miss resets. Mirrors we:scripts/operations/gate-health.mjs (compute-only steps, no sink).

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
