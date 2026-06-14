---
type: idea
workItem: story
size: 8
status: resolved
parent: "318"
dateOpened: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: "block:stepper"
tags: [exercise-app, auto-insurance, configurator, questionnaire, view-transitions, phase]
---

> **Resolved 2026-06-12 — built; WE deliverable = activated the draft Stepper block.** The stepped quote
> questionnaire (Driver → Vehicle → Coverage → Review) is live on a **newly-activated `stepper` block**:
> the draft contract (#053) had no runtime, so per the loop *"a draft is the prize"* I shipped
> `StepperBehavior` (`blocks/stepper/StepperBehavior.ts`, draft→active, 6 unit tests) — locked
> progression, per-step validation gate (on the step's child controls; a `<fieldset>` is barred from
> constraint validation), `aria-current="step"`, Step N of M announcement, step-change / flow-complete.
> The wizard consumes it; `flow-complete` rates the assembled policy and renders the premium + UW
> decision-trace. `check:app-conformance` = **100% (11/11)**. Surfaced gaps filed: the configurator
> constraint-graph branching ([#096], still a gap — this flow is linear-only), directional step
> view-transitions ([#015]), and a router stamping bug ([#423]).

# Phase S1 — quote questionnaire (configurator)

Functional phase of exercise app B ([#318](/backlog/318-exercise-app-auto-insurance-lifecycle/)). The
conditional, multi-step quote questionnaire (drivers, vehicles, history, prior coverage) with branching
sub-forms, cross-field validation, and a stepped flow with view-transitions. See the
[requirements PRD](/reports/2026-06-12-exercise-app-auto-insurance-requirements/) (M1). **Drives:**
Technical Configurator / NL-to-config (constraint graph), view-transitions, validation, persistence
(save-and-resume).
