---
kind: epic
status: active
parent: "314"
ongoing: true
dateOpened: "2026-06-11"
dateStarted: "2026-06-12"
relatedReport: reports/2026-06-12-exercise-app-auto-insurance-requirements.md
tags: [exercise-app, insurance, policy-lifecycle, claims, requirements, configurator]
crossRef: { url: /backlog/314-flagship-exercise-apps/, label: "Flagship exercise apps (#314)" }
---

# Exercise app B (personal auto insurance lifecycle + claims)

Candidate **B** (insurance) from the flagship-exercise-apps epic ([#314](/backlog/314-flagship-exercise-apps/)).
Derive a full, complex requirements set for a **personal auto insurance** app covering the whole
policy lifecycle — **quote → bind → issue → endorse → renew → claim** — plus an **FNOL / claims**
flow. Rating & underwriting rules, deeply conditional questionnaires, a coverage hierarchy, document
handling, and roles (agent / underwriter / adjuster / policyholder). Scope held to **one product
line (personal auto)** to keep requirements tractable. Fidelity to real insurance law is optional.
This story ends when the requirements are documented well enough to scope the build.

## What to derive

- **Lifecycle states & transitions:** quote, bind, issue, endorsement (mid-term change), renewal, cancellation, claim.
- **Quote/underwriting:** conditional questionnaire (driver, vehicle, history), rating inputs, eligibility & underwriting rules.
- **Coverages:** coverage hierarchy (liability / collision / comprehensive / add-ons), limits, deductibles, exclusions.
- **Claims / FNOL:** first notice of loss intake, claim triage, adjuster workflow, status, payout.
- **Actors & roles:** agent, underwriter, adjuster, policyholder (+ permissions across lifecycle stages).

## Surfaces it stresses (per #314 matrix)

Validation + requirement-as-code (primary), business-rule / proof-of-compliance (primary),
Technical Configurator / NL-to-config (primary — conditional questionnaires), nav blocks /
view-transitions (primary — stepped quote), webidentity / webpermissions (primary), tree-select
(coverage hierarchy), file handling (claim docs).

## Requirements source strategy

Derive from first principles, lightly anchored to a generic personal-auto policy/coverage structure —
complex but not a compliance project.

## Done when

A requirements doc exists (lifecycle state machine, questionnaire & rating rules, coverage model,
claims flow, role/permission map) detailed enough to break the build into agent-ready slices.
**Done (2026-06-12)** — see the [requirements PRD](/reports/2026-06-12-exercise-app-auto-insurance-requirements/).

---

## Settled decisions (2026-06-12)

- **Product line:** personal auto only. **Visual register:** modern-SaaS insurtech (the register deferred
  from the loan app) via a swappable `theme-<register>` token layer — proves the same intents/blocks reskin.
- **Two entity lifecycles** (policy + claim) both on **Web Lifecycle** — the headline reuse of what the loan
  app drove. Insurance is the **second consumer** of the already-shipped standards (lifecycle,
  status-indicator, audit, decision-trace, master-detail, data-table, pagination, selection, router) — a
  cross-app conformance check — and drives the **new** gaps (tree-select, configurator, files,
  view-transitions, permissions, persistence).
- **Build order:** domain + rating engine → stepped quote → coverage tree → underwriting → bind/issue →
  endorsements → renewals → FNOL → adjuster workbench → portal/dashboards → docs/notify/audit.

## WE surfaces this app drives (live tracker)

Populated as the conformance loop runs (`check:app-conformance --app=demos/auto-insurance`). **Reused
(already shipped):** lifecycle · status-indicator · audit-trail · decision-trace · master-detail ·
data-table · pagination · selection · router. **New gaps to drive:** tree-select · configurator /
NL-to-config · file handling · view-transitions · webpermissions/webidentity · webpersistence. Score
tracked from S0 baseline.

## Functional phase cards (the S0–S10 build plan)

One story per requirements module (mirrors #317's #378–#388):

- [#411](/backlog/411-ins-phase-domain-rating/) S0 — domain + rating engine
- [#412](/backlog/412-ins-phase-quote-questionnaire/) S1 — quote questionnaire (configurator)
- [#413](/backlog/413-ins-phase-coverage-tree/) S2 — coverage builder (tree-select)
- [#414](/backlog/414-ins-phase-underwriting/) S3 — underwriting referral & workbench
- [#415](/backlog/415-ins-phase-bind-issue/) S4 — bind, issue & payment
- [#416](/backlog/416-ins-phase-endorsements/) S5 — endorsements
- [#417](/backlog/417-ins-phase-renewals-cancellation/) S6 — renewals & cancellation
- [#418](/backlog/418-ins-phase-fnol/) S7 — FNOL & claims intake
- [#419](/backlog/419-ins-phase-adjuster-workbench/) S8 — adjuster workbench
- [#420](/backlog/420-ins-phase-portal-dashboards/) S9 — portal & book-of-business dashboards
- [#421](/backlog/421-ins-phase-docs-notify-audit/) S10 — documents, notifications & audit

**Progress:**
- S0 ([#411](/backlog/411-ins-phase-domain-rating/)) **done** — `demos/auto-insurance/` live, rating + UW
  engine + the book pipeline consuming all shipped blocks; baseline **100% (10/10)**.
- S1 ([#412](/backlog/412-ins-phase-quote-questionnaire/)) **done** — the quote wizard; WE deliverable was
  **activating the draft Stepper block** (#053 draft→active, `StepperBehavior`, locked progression +
  per-step gate). Conformance **100% (11/11)**. Surfaced gaps filed: configurator constraint-graph
  ([#096]), step view-transitions ([#015]), a route-view stamping bug ([#423]).

- S2 ([#413](/backlog/413-ins-phase-coverage-tree/)) **done** — the coverage builder; WE deliverable was
  **building the `tree-select` block** ([#296], realizes the `hierarchy` intent: APG tree, cascade
  selection). Conformance **100% (12/12)**.

- S3 ([#414](/backlog/414-ins-phase-underwriting/)) **done** — the underwriter workbench (referred queue →
  role-scoped guarded Approve/Decline). WE value: first real exercise of the **weblifecycle GuardResolver
  seam**; pure reuse otherwise. Surfaced the production-authz gap (Web Guards [#289]). Conformance
  **100% (12/12)**.

- S7 ([#418](/backlog/418-ins-phase-fnol/)) **done** — FNOL + claims workbench. WE value: the **claim
  lifecycle is a SECOND Web Lifecycle entity machine** (fnol→…→closed) on the shared registry, proving the
  standard generalizes beyond one entity; adjuster role-scoped guarded transitions auto-log to the claim's
  audit. FNOL uses a native `<input type=file>` (native-first); the richer file-upload component is the gap
  ([#028]). Conformance **100% (12/12)**.

**Next:** S4 ([#415](/backlog/415-ins-phase-bind-issue/)) bind/issue, S5 endorsements, S6 renewals — more
policy-lifecycle depth — or codify a *new* standard from the filed gaps (**#096 configurator**, **#015
view-transitions**, **#028 file-upload block**, **#289 Web Guards provider**). Across both apps: 10 active
blocks, two entity lifecycles on Web Lifecycle, guard seam exercised; gaps filed: #289, #096, #015, #028,
#423 (router bug).

## WE-surface consumption slices

Created as the app consumes each surface (resolved = conformant), like #317's #371–#374. The reused
standards above are consumed first (cross-app check); each new gap gets its own card when the loop reaches it.

## Program tooling

Driven by the shared conformance loop — [#377](/backlog/377-conformance-loop-tooling/)
(`check:app-conformance` benchmark, `/exercise-app` skill, the workflow doc + blockers view). Method:
[we:exercise-app-workflow.md](/docs/agent/exercise-app-workflow/) (Claude: `/exercise-app auto-insurance`).
