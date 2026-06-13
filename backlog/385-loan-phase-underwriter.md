---
type: idea
locus: exercise-app
workItem: story
size: 5
status: open
parent: "317"
dateOpened: "2026-06-12"
tags: [exercise-app, loan-origination, underwriting, phase]
---

# Phase S8 — underwriter workbench (conditions + decisioning)

Functional phase of exercise app A ([#317](/backlog/317-exercise-app-loan-origination/)). A review surface:
file summary + rules-engine trace + (mock) AUS findings + document checklist side by side; add/clear
conditions (PTA/PTD/PTF), issue a decision (approve-with-conditions / suspend / decline with reason codes),
all audit-logged. See the [requirements report](/reports/2026-06-11-exercise-app-loan-origination-requirements/)
(M7). Consumes the decision-trace ([#355]) and audit-trail ([#357]) candidate standards.
