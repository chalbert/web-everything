# Personal auto insurance — exercise-app requirements (app B, #318)

**Point:** Full, complex requirements for a personal-auto insurance app covering the whole policy
lifecycle (quote → bind → issue → endorse → renew → cancel) plus FNOL/claims — the second flagship
exercise app (#318), a forcing function for Web Everything. Fidelity to real insurance law is optional;
requirements need only be full and complex enough to stress the platform.

Tracked by epic [#318](/backlog/318-exercise-app-auto-insurance-lifecycle/). Companion to the loan-app
PRD (`we:reports/2026-06-11-exercise-app-loan-origination-requirements.md`).

## Scope

One product line — **personal auto** — to keep requirements tractable while still deeply complex. The app
spans the **policy lifecycle** and a coupled **claims** lifecycle, two configurators (quote questionnaire,
coverage builder), a rating/underwriting rules engine, four roles, and document handling. It is built
**platform-first**: every UI/behavior need resolves against Web Everything (consume active blocks/intents;
where a surface is draft/uncodified, that gap *is* the WE work this app drives — see
[we:exercise-app-workflow.md](../docs/agent/exercise-app-workflow.md)).

**Visual register (settled): modern-SaaS insurtech** — the distinct register held back from the loan app
(which is enterprise-finance). Same intents/blocks, a different `theme-<register>` token layer, proving the
platform reskins. (Per the per-app-register program rule.)

## Actors & roles

- **Policyholder / applicant** — starts a quote, answers the questionnaire, selects coverages, binds & pays,
  files a claim (FNOL), uploads documents, views policy.
- **Agent** — assists/creates quotes, overrides some rating factors within bounds, binds on behalf, manages
  the book of business.
- **Underwriter** — reviews referred risks, approves/declines/conditions, sets manual rating adjustments.
- **Adjuster** — owns the claim after FNOL: triage, investigation, reserves, approve/deny, payout.

### Permission model (the webpermissions / webidentity exercise)

Role × lifecycle-stage matrix. Examples: a policyholder may edit a *quote* but not a *bound* policy
(endorsements are agent/UW-gated); only an underwriter may clear an underwriting referral; only an adjuster
may set a reserve or issue a payout; cross-customer visibility is agent/UW/adjuster-only. Transitions are
role-scoped and guarded (composes **Web Lifecycle** + **Web Guards**); every consequential action is audited
(**Web Audit**).

## Domain glossary

Quote, Application/Submission, Risk (driver + vehicle), Rating factor, Premium, Coverage, Limit, Deductible,
Endorsement, Renewal, Cancellation (incl. non-pay, UW, insured-request), Reinstatement, Policy term, FNOL,
Claim, Reserve, Subrogation, Payout, Reason code, Rule set version.

## Lifecycle / state machine (the Web Lifecycle exercise)

**Policy lifecycle:** `quote → referred? → quoted → bound → issued → in-force → (endorsed → in-force) →
(renewal-offered → renewed | non-renewed) → (cancelled | expired)`; `lapsed → reinstated → in-force`.
Guards: bind requires a clean/approved UW outcome + payment; endorsement requires in-force + role; cancel
requires reason + role.

**Claim sub-lifecycle (a second entity lifecycle on the same app):** `fnol → triage → investigating →
(approved → paying → paid → closed | denied → closed) | (subrogation)`. Role-scoped to the adjuster; each
transition audited; a denial carries reason codes (the **decision-trace** standard).

## Functional requirements by module

### M1 — Quote questionnaire (configurator exercise)
Conditional, multi-step questionnaire (driver(s), vehicle(s), history, prior coverage). Branches: added
driver → sub-form; prior incidents → detail rows; vehicle lookup → garaging address. Cross-field validation
(license vs DOB, VIN format). **Stepped flow with view-transitions.** Drives the **Technical Configurator /
NL-to-config** constraint-graph paradigm.

### M2 — Rating engine (requirement-as-code / rules-as-code exercise)
Derive premium from rating factors: territory, driver age/experience, vehicle symbol, mileage, coverage
selections, prior-incident surcharges, multi-policy/good-driver discounts. Emits an explainable
**DecisionRecord** (each factor → contribution) — consumes the **decision-trace** standard. Versioned rate
table (reproducibility).

### M3 — Coverage builder (tree-select + configurator)
Coverage **hierarchy** (liability [BI/PD] → med-pay/PIP → collision → comprehensive → add-ons [rental,
roadside, gap]) with limits/deductibles and dependency/eligibility constraints (collision requires comp on
some carriers; UM tied to BI). Drives **tree-select** + constraint validation. Recomputes premium live (M2).

### M4 — Underwriting referral & workbench
Eligibility/UW rules produce clean / refer / decline with reason codes. An UW workbench (referred risks +
rule trace + documents) to approve/condition/decline — composes **decision-trace** + **master-detail** +
**Web Audit**.

### M5 — Bind, issue & payment
On acceptable UW + payment, transition quote → bound → issued; generate the policy doc + ID cards (mock).
Guarded transition (Web Lifecycle + Web Guards); audited.

### M6 — Endorsements (mid-term change)
Add/remove vehicle or driver, change coverages or address → re-rate the *remaining term* (proration),
produce an endorsement record, re-issue docs. Role-gated; audited; a lifecycle sub-flow.

### M7 — Renewals & cancellation
Renewal offer (re-rate at term end), accept/non-renew; cancellation (non-pay / insured-request / UW) with
proration + reason; reinstatement. All guarded lifecycle transitions.

### M8 — FNOL & claims intake
First notice of loss: incident questionnaire (date, type, parties, photos/docs), creates a Claim entity with
its own lifecycle. Drives **file handling** + a second lifecycle + status-indicator.

### M9 — Adjuster workbench
Claim triage, reserve setting, investigation notes, document checklist, approve/deny (reason codes →
decision-trace), payout. master-detail (claims list → claim detail) + Web Audit + permissions.

### M10 — Policyholder portal & book-of-business dashboards
Policyholder: policy summary, cards, documents, claims status. Agent/UW: pipelines (quotes, referrals,
renewals, claims) at scale → **collection-ops** (data-table + pagination), saved views.

### M11 — Documents, notifications & audit
Document handling (upload/generate: dec page, ID cards, claim docs). Event-driven notifications (bound,
referred, claim status). Immutable **audit trail** per policy and per claim (Web Audit; lifecycle + decision
events auto-feed it).

## Business-rule catalog (rules-as-code home)

- **Rating factors:** base rate × territory × driver × vehicle × coverage × discounts/surcharges.
- **Eligibility/UW:** max incidents, license status, lapse history, vehicle-value caps, high-risk vehicle
  list → clean / refer / decline + reason codes.
- **Coverage constraints:** dependency/exclusion rules in the coverage tree.
- **Claims:** coverage-applies check, deductible application, reserve guidance, fraud-flag heuristics.

Each rule evaluation is a versioned, explainable **DecisionRecord** (decision-trace standard).

## Data model (entities)

Quote/Submission, Driver, Vehicle, RatingResult (DecisionRecord), Coverage[], Policy (term, status,
endorsements[]), Endorsement, RenewalOffer, Cancellation, Claim (status, reserves, payout), AuditEvent[],
Document[].

## Cross-cutting / non-functional

Save-and-resume (webpersistence) for long quotes; conditional-form performance; a11y across the stepped
flow; the modern-SaaS theme-token layer; deterministic seed data (no Math.random) for a realistic book.

## Platform-surface mapping (what each module exercises)

| Module | WE surfaces driven |
|---|---|
| M1 quote questionnaire | configurator/NL-config, view-transitions, validation, persistence |
| M2 rating engine | decision-trace, requirement-as-code |
| M3 coverage builder | tree-select, constraint validation, decision-trace |
| M4 UW workbench | decision-trace, master-detail, audit, permissions |
| M5 bind/issue | lifecycle, guards, documents, audit |
| M6 endorsements | lifecycle, rating (re-rate), audit |
| M7 renewals/cancel | lifecycle, guards, audit |
| M8 FNOL | files, lifecycle (claim), status-indicator |
| M9 adjuster workbench | master-detail, decision-trace, audit, permissions |
| M10 portal/dashboards | collection-ops (data-table + pagination), status-indicator |
| M11 docs/notify/audit | files, audit, reporting |

Already-shipped standards the loan app drove (lifecycle, status-indicator, audit, decision-trace,
master-detail, data-table, pagination, selection, router) are **consumed** here — insurance is their second
consumer, a cross-app conformance check. New gaps (tree-select, configurator, files, view-transitions,
permissions, persistence) are the WE work this app will drive.

## Settled decisions

- **Product line:** personal auto only.
- **Visual register:** modern-SaaS insurtech (the deferred register).
- **Two lifecycles:** policy + claim, both on Web Lifecycle (the headline reuse).
- **Build order:** domain + rating engine first (proves the rules at scale), then the stepped quote, then
  bind/issue, then claims — each slice consuming/ driving WE surfaces.

## Proposed build slices (→ functional-phase cards under #318)

S0 domain + rating engine · S1 quote questionnaire/configurator · S2 coverage builder (tree) · S3
underwriting referral/workbench · S4 bind/issue/payment · S5 endorsements · S6 renewals/cancellation · S7
FNOL · S8 adjuster workbench · S9 portal & dashboards · S10 documents/notifications/audit.
