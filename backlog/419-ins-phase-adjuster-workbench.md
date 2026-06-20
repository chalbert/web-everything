---
kind: story
locus: exercise-app
size: 5
status: resolved
parent: "318"
dateOpened: "2026-06-12"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: demos/auto-insurance/domain/adjuster.ts + app.ts S8 claim adjuster workbench (reason-coded approve/deny → decision-trace, reserve setting, investigation notes, doc checklist; consumes master-detail/decision-trace/audit)
tags: [exercise-app, auto-insurance, claims, adjuster, master-detail, phase]
---

# Phase S8 — adjuster workbench (claims)

Functional phase of exercise app B ([#318](/backlog/318-exercise-app-auto-insurance-lifecycle/)). Claim
triage, reserve setting, investigation notes, document checklist, approve/deny (reason codes →
decision-trace), payout. See the [requirements PRD](/reports/2026-06-12-exercise-app-auto-insurance-requirements/)
(M9). **Consumes:** master-detail, decision-trace, audit; **drives:** webpermissions.
