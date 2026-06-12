---
type: idea
workItem: story
size: 5
status: resolved
parent: "318"
dateOpened: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: none
tags: [exercise-app, auto-insurance, domain, rating, rules, phase]
---

> **Resolved 2026-06-12 — built.** `demos/auto-insurance/` S0 foundation: domain types, a deterministic
> 4k-policy book seed (no Math.random), a **rating engine** (multiplicative factors → 6-mo premium) + an
> **underwriting rules engine** that emits a per-policy decision-trace, two entity lifecycles (policy +
> claim), and a `toDecisionRecord` mapper. The harness rates the whole book client-side and renders the
> finding distribution + a clickable per-policy detail — consuming the SHIPPED blocks (data-table,
> pagination, master-detail, decision-trace, status-indicator, lifecycle, audit, router). **First
> `check:app-conformance` baseline = 100% (10/10), compliant** — insurance is the second consumer of the
> loan-app standards. App domain only; no new WE entity (graduatedTo none).

# Phase S0 — domain model + rating engine

Foundation of exercise app B ([#318](/backlog/318-exercise-app-auto-insurance-lifecycle/)). The domain
types (quote/driver/vehicle/coverage/policy/claim), deterministic seed (a realistic book, no Math.random),
and the **rating engine** that derives premium from rating factors and emits an explainable
**DecisionRecord** per factor. See the [requirements PRD](/reports/2026-06-12-exercise-app-auto-insurance-requirements/)
(M2). **Drives/consumes:** decision-trace (reuse), requirement-as-code. First S0 baseline scan.
