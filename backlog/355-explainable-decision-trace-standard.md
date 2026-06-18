---
type: idea
workItem: story
size: 5
status: resolved
dateOpened: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: "project:webdecisions"
tags: [candidate-standard, exercise-app-discovery, explainability, decision-trace, audit]
crossRef: { url: /backlog/093-business-rule-manager-proof-of-compliance/, label: "Related: business-rule / proof-of-compliance (#093)" }
---

> **Resolved 2026-06-12 — codified AND runtime shipped (one turn).** Graduated to the **Web Decisions**
> project (`webdecisions`) owning the **Decision Record** protocol (`decision-record`, draft; body in
> `we:src/_includes/project-webdecisions.njk` §`protocol-decision-record`) and the `decision-trace` intent.
> A deliberate variation: **schema-only protocol, no provider** — the `DecisionRecord` shape
> ({ subject, ruleSet {id,version}, criteria[], outcome, reasonCodes? }) IS the contract; the decision
> *engine* is out of scope (proof-of-compliance #093). The **`decision-trace` block**
> (`we:blocks/renderers/decision-trace/renderDecisionTrace.ts`, active, 5 unit tests) renders it and
> composes the status-indicator block for the outcome token. The loan app consumes it via a
> `toDecisionRecord` mapper (`we:demos/loan-origination/domain/decision.ts`) — the hand-rolled
> proof-of-compliance table is gone. `we:conformance.json` declares it → **`check:app-conformance` = 100%
> (9/9), compliant**. Kept distinct from webvalidation (form invalidity) and webtraces (execution spans).

# Candidate standard — Explainable decision / evaluation trace

Missing standard surfaced building the loan-origination app ([#317](/backlog/317-exercise-app-loan-origination/)).
The rules engine emits a **proof-of-compliance trace**: for each rule, its inputs, threshold, operator,
and outcome, aggregated into a finding. This "**why did the system decide this?**" record is a recurring
enterprise need (underwriting, eligibility, pricing, moderation) and has **no codified standard** for how
an evaluation result is *represented*, *rendered*, and *announced*. Backlog #093 gestures at it as a
business-rule concern, but the **explainability artifact itself** is unstandardized.

## What a standard would cover

- A normalized **evaluation-result schema** (rules/criteria, inputs, thresholds, outcomes, versioned ruleset).
- Canonical **rendering** (the trace table) + **announcement** of the result and its reasons.
- Reproducibility: the result records the standard/ruleset version it ran against.

## Relations & open questions

- Feeds **Web Reporting** ([#350]) as a report source and **Web Compliance** ([#351]) as evidence.
- Boundary vs `webvalidation` (form validity) — this is broader business-rule evaluation. Intent + schema, or a protocol?
