---
type: issue
workItem: task
status: resolved
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: none
tags: []
---

# Exclude non-budget batch stops from calibrate (weight or skip empty-pool/fork/gate sessions)

calibrate() now folds each session into capacityPoints as a context-weighted window mean (we:scripts/backlog.mjs), which down-weights but does not exclude low-signal sessions. A session that stopped for a NON-context reason (empty pool / surfaced fork / red gate) at low context% still enters the pool, and its points÷tiny-fraction extrapolation is noise biased low by fixed startup overhead. Thread the batch's stop-reason into calibrate (a --stop-reason flag, or a minimum context-pct floor) so only budget/context-limited sessions train the estimate — the change that actually makes the budget converge with use. Small, self-contained; the weighted-mean groundwork already landed.

## Progress (2026-06-14) — resolved

Added a `--stop-reason` flag to `calibrate` so only **capacity-bound** sessions train the budget estimate:

- **New pure module** [we:scripts/backlog/capacity.mjs](../scripts/backlog/capacity.mjs) — `NON_TRAINING_STOPS` (`empty-pool`/`empty`/`fork`/`gate`/`manual`/`abort`), `trainsEstimate(stopReason)` (fail-open: unknown/absent reason trains, backward compatible), and `capacityFromSamples(samples)` (context-weighted mean over non-`excluded` samples; null when none train). Pure so it's testable without we:backlog.mjs's CLI dispatch firing on import.
- **`calibrate()`** now reads `--stop-reason`, records it on the sample, marks a work-bound stop `excluded: true` (kept for audit, zero weight), and computes `capacityPoints` via `capacityFromSamples` with a `prev` fallback. Chose stop-reason over a context-pct floor as the more correct signal (a floor would wrongly drop a legit small-but-budget-bound session).
- **Tests** [we:capacity.test.mjs](../scripts/backlog/__tests__/capacity.test.mjs) (7, green): weighting, exclusion, null fallback, convergence (exact at any n — the property a fixed-α EMA lacked).
- **Docs** — `we:docs/agent/backlog-workflow.md` "Calibrating the budget" and the batch we:SKILL.md (both calibrate call-sites) now pass + explain `--stop-reason`.

CLI smoke confirmed: `fork`@12% recorded `excluded` (didn't train); `budget`@31% trained. 25/25 backlog tests, `check:standards` green.
