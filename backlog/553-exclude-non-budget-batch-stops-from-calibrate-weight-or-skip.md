---
type: issue
workItem: task
status: open
dateOpened: "2026-06-14"
tags: []
---

# Exclude non-budget batch stops from calibrate (weight or skip empty-pool/fork/gate sessions)

calibrate() now folds each session into capacityPoints as a context-weighted window mean (scripts/backlog.mjs), which down-weights but does not exclude low-signal sessions. A session that stopped for a NON-context reason (empty pool / surfaced fork / red gate) at low context% still enters the pool, and its points÷tiny-fraction extrapolation is noise biased low by fixed startup overhead. Thread the batch's stop-reason into calibrate (a --stop-reason flag, or a minimum context-pct floor) so only budget/context-limited sessions train the estimate — the change that actually makes the budget converge with use. Small, self-contained; the weighted-mean groundwork already landed.
