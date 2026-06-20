---
kind: story
size: 5
status: resolved
parent: "317"
dateOpened: "2026-06-11"
dateResolved: "2026-06-11"
graduatedTo: none
tags: [exercise-app, loan-origination, domain, rules-engine, phase]
---

# Phase S0/S7 — domain model + rules-as-code engine (foundation)

Foundation phase of exercise app A ([#317](/backlog/317-exercise-app-loan-origination/)). **Resolved**:
built the entity model (1003/URLA-shaped), the rules-as-data engine (JSON predicate DSL, AUS-style
aggregation, per-rule proof-of-compliance trace), product catalog + rate sheet + LLPA pricing, derived
underwriting facts, a deterministic 5k-application seed, and the mock provider seam. App domain logic
(not a WE standard); it surfaced the decision-trace candidate standard ([#355]).
