---
kind: story
size: 5
status: resolved
parent: "318"
dateOpened: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: "block:tree-select"
tags: [exercise-app, auto-insurance, coverage, tree-select, constraints, phase]
---

> **Resolved 2026-06-12 — built; WE deliverable = the tree-select block ([#296]).** The quote wizard's
> Coverage step is now a coverage **hierarchy** on the shipping `tree-select` block (liability → medical →
> physical-damage → add-ons), cascade selection with `mixed` parents, full APG tree keyboard. Base
> liability is pre-checked; selections flow into the rated policy (collision/comprehensive priced in).
> `check:app-conformance` = **100% (12/12)**. The cross-field eligibility constraints remain the
> configurator gap ([#096]).

# Phase S2 — coverage builder (tree-select)

Functional phase of exercise app B ([#318](/backlog/318-exercise-app-auto-insurance-lifecycle/)). The
coverage **hierarchy** (liability → med-pay/PIP → collision → comprehensive → add-ons) with limits,
deductibles, and dependency/eligibility constraints, recomputing premium live (S0). See the
[requirements PRD](/reports/2026-06-12-exercise-app-auto-insurance-requirements/) (M3). **Drives:**
tree-select, constraint validation; **consumes:** decision-trace.
