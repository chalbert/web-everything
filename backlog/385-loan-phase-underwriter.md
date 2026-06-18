---
type: idea
locus: exercise-app
workItem: story
size: 5
status: resolved
parent: "317"
dateOpened: "2026-06-12"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: demos/loan-origination (S8 underwriter workbench — domain/underwriting.ts + app.ts conditions/decisioning)
tags: [exercise-app, loan-origination, underwriting, phase]
---

# Phase S8 — underwriter workbench (conditions + decisioning)

Functional phase of exercise app A ([#317](/backlog/317-exercise-app-loan-origination/)). A review surface:
file summary + rules-engine trace + (mock) AUS findings + document checklist side by side; add/clear
conditions (PTA/PTD/PTF), issue a decision (approve-with-conditions / suspend / decline with reason codes),
all audit-logged. See the [requirements report](/reports/2026-06-11-exercise-app-loan-origination-requirements/)
(M7). Consumes the decision-trace ([#355]) and audit-trail ([#357]) candidate standards.

## Progress

- **Domain** [we:demos/loan-origination/domain/underwriting.ts](/demos/loan-origination/domain/underwriting.ts) — pure condition + decisioning transitions: `clearCondition` / `waiveCondition` / `conditionsAllResolved` / `openConditionCounts` (PTA/PTD/PTF), and `issueDecision` (approve-with-conditions / suspend / decline) with `suggestedReasonCodes` auto-seeding ECOA-style codes from the rules-engine finding for a non-approval. The human *decision* is kept distinct from the machine *finding*.
- **Workbench view** in [we:app.ts](/demos/loan-origination/app.ts) — `renderUnderwriterWorkbench` in the loan detail (alongside the rules trace + the S5 document checklist — the side-by-side review surface): conditions list with status chips + Clear/Waive, and a decision form (outcome + reason codes) → issues `app.decision`. CSS in we:app.css.
- **Standards consumed (active — no new gap):** conditions/decision states render via **status-indicator**; the issued decision normalizes to the **decision-trace** record (`toDecisionRecord`); every clear/waive/issue is **audit-trail** logged (before/after) + notified. `check:app-conformance` stays **compliant** (0 FAIL, 2 pre-existing tagged GAP).
- Gate: `check:standards` 0 errors · conformance compliant · demo loads (200) · typecheck clean. Commit → webeverything.
