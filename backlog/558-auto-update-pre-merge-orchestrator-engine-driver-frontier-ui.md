---
type: issue
workItem: story
size: 8
parent: "099"
status: open
dateOpened: "2026-06-14"
tags: [auto-update, runner, orchestrator, pre-merge, frontier-ui, renovate, update-policy]
---

# Auto-update pre-merge orchestrator + engine driver (Frontier UI)

Slice 1 of the #497 ruling (Fork 1 → A). Build the thin Frontier UI orchestrator package (next to the upgrader engine) that owns the update-policy gate evaluation — manifest-driven severity (#102), migration routing via the upgrader engine (#094) — and drives an incumbent engine (Renovate/Dependabot) as the swappable pre-merge execution primitive: trigger → cool-off (minimumReleaseAge) → scan → test-in-branch → severity → auto-merge low-risk-green / human-gate major+visual. WE stays protocol-only; this publishes @frontierui (no-leakage invariant). This is the foundation slice the other three build on. Per #497 Ruling and slice plan.
