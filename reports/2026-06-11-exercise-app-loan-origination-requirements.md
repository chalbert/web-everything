# Loan / mortgage origination — exercise-app requirements

**Date**: 2026-06-11
**Point**: Full, complex requirements for a residential **mortgage loan-origination** app, derived as candidate **A** of the flagship-exercise-apps program. The point is coverage: a workload rich enough to stress the standard's components, intents, and projects end-to-end (validation/rules, collection-ops, identity/permissions, persistence, configurator, file handling, stepped navigation). Fidelity to real lending law (URLA, TRID, ECOA, AUS) is **approximated, not certified** — the structure is borrowed because it is genuinely complex, not to be a compliant LOS.
**Backlog item**: `/backlog/317-exercise-app-loan-origination/`
**Parent epic**: `/backlog/314-flagship-exercise-apps/`
---

## Scope

A residential first-mortgage **origination** flow from application to a **clear-to-close** decision. In scope: borrower application, document collection, product/rate selection, automated eligibility + affordability evaluation, and a human underwriting workbench that issues conditions and a decision. **Out of scope** (named so the boundary is deliberate): actual closing/funding/disbursement, secondary-market sale, servicing, and real credit-bureau / AUS integrations — those are **mocked** behind a provider seam so the app stays self-contained.

The app is anchored on real industry structure so the requirements are non-trivial:
- The application mirrors the **URLA / Fannie Mae Form 1003** section model.
- Affordability uses the standard **DTI** (debt-to-income) and **LTV** (loan-to-value) ratios.
- Decisioning mirrors an **AUS findings** model (Approve/Eligible, Refer, Refer-with-Caution) plus a human **conditions** loop.
- Disclosures mirror **TRID** timing (Loan Estimate within 3 business days of application).

None of these need to be legally exact; they need to be **complex and internally consistent**.

## Actors & roles

| Role | Who | Core capability |
|------|-----|-----------------|
| **Borrower** | applicant (+ optional co-borrower) | own & edit their application while in draft; upload docs; e-sign disclosures; view status |
| **Loan officer (LO)** | sales-side originator | start/co-edit an application, run product/pricing, submit to processing, see own pipeline |
| **Processor** | operations | assemble the file, order (mock) verifications, manage the document checklist, clear blocking gaps, submit to underwriting |
| **Underwriter (UW)** | credit-risk decisioner | run the rules engine, review AUS findings, add/clear **conditions**, issue the **decision** |
| **Admin** | program owner | manage product catalog, rate sheet, and rule thresholds; read-only on all files |

A single human may hold multiple roles in a small lender; the app models **role**, not person — a user account carries a set of roles (ties to **governance personas**, [#166]).

### Permission model (the webpermissions / webidentity exercise)

Permissions are **field-, action-, and state-scoped**, not just page-scoped — this is the privacy/authorization pressure-test:

- **State-scoped editing**: the borrower can edit the application only in `draft`; once `submitted` it becomes read-only to them and editable by the processor. (See lifecycle below.)
- **Field-scoped visibility**: demographic/HMDA fields (collected for fair-lending monitoring) are visible to UW/Admin for compliance but **never used by the rules engine** and hidden from the LO's pricing view — a deliberate "collected-but-walled-off" data class.
- **Action-scoped authority**: only an **Underwriter** may issue a decision or clear an underwriting condition; only **Admin** may edit rule thresholds; the LO may *quote* but not *approve*.
- **Ownership**: an LO sees only their own pipeline; a processor/UW sees the queue assigned to them; Admin sees all.

## Domain glossary

- **Application (1003)** — the loan request; the root aggregate.
- **DTI** — total monthly debt ÷ gross monthly income; **front-end** = housing only, **back-end** = all debts.
- **LTV / CLTV** — loan amount ÷ property value (CLTV includes subordinate liens).
- **Reserves** — months of housing payment the borrower retains in liquid assets after closing.
- **AUS findings** — automated recommendation: `Approve/Eligible`, `Refer`, `Refer w/ Caution`, `Out of Scope`.
- **Condition** — a requirement the file must satisfy before approval; `prior-to-approval (PTA)`, `prior-to-docs (PTD)`, or `prior-to-funding (PTF)`.
- **Loan Estimate (LE)** — standardized cost disclosure owed to the borrower shortly after application.
- **Clear to close (CTC)** — all conditions cleared; the terminal "approved" state for this app's scope.

## Lifecycle / state machine

The application is a state machine; transitions are guarded by role + completeness rules. This drives the nav/view-transition and permission exercises.

```
 draft ──submit──▶ submitted ──assign──▶ processing ──refer──▶ underwriting
   ▲                                         │                     │
   │ (borrower edits)                        │ return-for-info     ├─▶ approved-with-conditions ──clear-all──▶ clear-to-close
   └─────────── return-to-borrower ◀─────────┘                     ├─▶ suspended (needs info) ──resubmit──▶ underwriting
                                                                    └─▶ declined  (terminal)
                                                                          withdrawn (terminal, any non-terminal state)
```

Guards (examples): `draft→submitted` requires all **required 1003 sections complete** + borrower e-signature on the initial disclosure set; `processing→underwriting` requires the **document checklist** to have no `blocking` gaps; `approved-with-conditions→clear-to-close` requires **every PTA/PTD condition** in state `cleared`.

## Functional requirements by module

### M1 — Borrower application wizard (the 1003)

A multi-step, resumable wizard mirroring the URLA sections. Each step validates independently; the borrower can move freely between completed steps but cannot submit until all required steps pass.

1. **Loan & property** — purpose (purchase / refinance), occupancy, property address & type, estimated value, requested loan amount & term.
2. **Borrower info** — identity, contact, SSN (masked), marital status, dependents, current/former address (24-month history required).
3. **Employment & income** — employer(s), position, time on job, monthly income by type (base, overtime, bonus, commission, other); self-employment branch with different fields. **Repeating section** (add/remove employers).
4. **Assets** — bank/investment accounts, balances; used for reserves. **Repeating.**
5. **Liabilities** — revolving/installment debts, monthly payment, balance; can mark "paid off at closing". **Repeating.**
6. **Real estate owned** — other properties (refinance/investment cases). **Repeating, conditional.**
7. **Declarations** — yes/no legal questions (bankruptcy, judgments, etc.); a "yes" reveals a follow-up explanation field.
8. **Demographic (HMDA)** — optional self-identification; walled off from the rules engine (see permissions).

**Cross-field & conditional rules** (validation exercise): address history must cover 24 months or require a "previous address" entry; self-employment hides W-2 fields and shows business fields; a `purchase` purpose requires a down-payment/asset reconciliation; declarations "yes" makes the explanation field required.

### M2 — Document checklist & upload

- A **dynamic checklist** generated from the application shape: e.g. `paystub` + `W-2` for wage earners; `business returns` + `P&L` for self-employed; `bank statements` for every asset account; `purchase agreement` for purchases. Rules-driven, not static.
- Each item has a **state**: `requested → uploaded → accepted | rejected(reason)`; rejected re-opens the request.
- **Blocking vs non-blocking**: some items block the `processing→underwriting` transition; others are informational.
- Upload supports drag-and-drop, multi-file, and paste-from-clipboard (the files/clipboard intent exercise); client-side type/size validation; a (mock) virus-scan + classify step.

### M3 — Save-and-resume / drafts (persistence exercise)

- Every wizard step autosaves; the borrower can leave and return days later to the exact step and field state.
- **Conflict handling**: if an LO co-edits the same draft, a last-writer-wins-with-warning or field-merge strategy (decision below) keeps the two views consistent.
- A visible "last saved" indicator; offline-tolerant queueing of saves is a stretch goal.

### M4 — Disclosures & e-sign

- On `submit`, the app generates an initial **disclosure package** (incl. a mock **Loan Estimate**) and records a TRID-style **3-business-day** clock.
- The borrower must **e-sign** (typed/drawn consent + timestamp + audit record) before the file advances. Re-disclosure is triggered if a "changed-circumstance" materially alters terms.

### M5 — Product & rate selection (configurator exercise)

- The LO (or borrower in a self-serve mode) selects a **loan product** from a catalog (e.g. 30-yr fixed, 15-yr fixed, 7/6 ARM, FHA, VA, jumbo). Products have **eligibility constraints** (min credit score, max LTV, loan-amount limits, occupancy) that filter the available set given the application.
- A **rate/price** is derived from a rate sheet keyed by `(product, LTV band, credit band, term, lock period)` plus **loan-level price adjustments (LLPAs)**. Choosing a product recomputes payment, APR (approx), and cash-to-close.
- This is the **Technical Configurator** surface: a constraint graph (requires/excludes) over product + borrower attributes, with invalid combinations blocked and explained.

### M6 — Eligibility & affordability rules engine (requirement-as-code exercise)

The core rules surface. Inputs are derived from the application; outputs are a findings object. Rules are **declarative and versioned**, owned by Admin, and produce an explainable trace.

Representative rule set (thresholds illustrative, Admin-editable):

| Rule | Logic (illustrative) | Outcome |
|------|----------------------|---------|
| Back-end DTI | `totalMonthlyDebt / grossMonthlyIncome ≤ 0.43` (≤0.50 with compensating factors) | pass / refer / fail |
| Front-end DTI | `housingPayment / grossMonthlyIncome ≤ 0.31` | pass / refer |
| LTV ceiling | `loanAmount / propertyValue ≤ product.maxLTV` | pass / fail (per product) |
| Min credit score | `creditScore ≥ product.minScore` | pass / fail |
| Reserves | `liquidAssetsAfterClose ≥ product.minReserveMonths × housingPayment` | pass / refer |
| Income stability | `monthsOnJob ≥ 24 OR documented continuity` | pass / refer |
| Down payment source | purchase: assets reconcile to down payment + closing + reserves | pass / refer |

The engine aggregates rule outcomes into an **AUS-style finding** (`Approve/Eligible` if all pass; `Refer` if any refer; `Ineligible` if any hard-fail) with a **per-rule explanation trace** — this is the **proof-of-compliance** artifact ([#093]): every decision shows which rules fired on which inputs at which threshold version.

### M7 — Underwriter workbench

- A focused review surface: the file summary, the rules-engine trace, the (mock) AUS findings, and the document checklist side by side.
- The UW can **add conditions** (from a library or free-text), classify them PTA/PTD/PTF, assign them to borrower/processor, and **clear** them as satisfied.
- The UW issues a **decision**: `approve-with-conditions`, `suspend` (needs info), or `decline` (with adverse-action reason codes, an ECOA-style touch).
- All actions are audit-logged with actor, timestamp, and before/after.

### M8 — Pipeline & dashboards (collection-ops exercise)

- Role-scoped **pipeline tables**: LO sees their applications; processor/UW see their queues; Admin sees all.
- Columns: borrower, product, amount, state, days-in-state, next action, assigned-to. **Sort, multi-filter, saved views, bulk actions** (e.g. bulk-assign, bulk-request-docs), and **pagination** over a large synthetic dataset (seed 1–5k applications to stress windowing).
- SLA/aging highlights (e.g. files stuck >N days in a state).

### M9 — Notifications & audit trail

- Event-driven notifications (state changes, condition added, doc rejected) to the relevant actor.
- A complete, immutable **audit trail** per application — the backbone for proof-of-compliance and the permissions story.

## Business-rule catalog (rules-as-code home)

The rules in M5 (product eligibility) and M6 (affordability) are the **codified rule set**. Requirements for this catalog:

- Rules are **data**, not code branches — an Admin edits thresholds without a deploy (extends-platform-default config pattern).
- Each rule is **versioned**; a decision records the **threshold version** it ran against (so a re-run is reproducible).
- Each rule emits a **structured explanation** (input values, threshold, operator, outcome) → the proof-of-compliance trace.
- Product eligibility and affordability share one **rule-expression model** (the configurator constraint graph and the affordability rules are the same shape: predicate over application facts).

## Data model (entities)

`Application` (root) ─< `Borrower` (1–2) ─< `Employment`, `IncomeItem`
`Application` ─< `Asset`, `Liability`, `RealEstateOwned`, `Declaration`
`Application` ─ `LoanRequest` (product, amount, term, rate, lock) ─ `Property`
`Application` ─< `Document` (checklist item + uploaded files + state)
`Application` ─< `Condition` (type, status, assignee)
`Application` ─ `Decision` (finding, reason codes, ruleRunVersion)
`Application` ─< `AuditEvent`, `Disclosure` (incl. e-sign record)
Catalog: `Product`, `RateSheetEntry`, `Rule` (versioned), `LLPA`

## Cross-cutting / non-functional

- **Validation**: every form is schema-validated client-side with cross-field rules; submission re-validates server-side (mock). Native-first: HTML constraint validation as the base, library only as enhancement.
- **Permissions**: enforced at field, action, and state granularity (above) — not just route guards.
- **Persistence**: durable drafts + resumable wizard; optimistic autosave.
- **Accessibility**: full keyboard operation, announced step changes & validation errors, ARIA on the wizard and pipeline table.
- **Provider seams (mocked)**: credit pull, AUS, income/asset verification, e-sign vendor, and document classification are all behind a **mock-proxy provider** ([#107]) so the app runs standalone.
- **Theming**: lender-branded theme via the theme-color intent.

## Platform-surface mapping (what each module exercises)

| Module | WE surfaces stressed |
|--------|----------------------|
| M1 wizard | validation + requirement-as-code, nav blocks / view-transitions, repeating-section collection-ops, persistence |
| M2 docs | clipboard/DnD/files intents, collection-ops (checklist), rules-driven generation |
| M3 drafts | webpersistence (save & resume, conflict) |
| M4 disclosures | view-transitions, audit, e-sign component |
| M5 product/rate | Technical Configurator / NL-to-config, constraint graph, validation |
| M6 rules engine | requirement-as-code, business-rule / proof-of-compliance |
| M7 UW workbench | webpermissions (action-scoped), collection-ops (conditions), tree (condition library) |
| M8 pipeline | collection-ops at scale, pagination, windowing, saved views |
| M9 notif/audit | webidentity, audit substrate, permissions |

## Open decisions (to settle before/while building)

1. **Co-edit conflict strategy** (M3): last-writer-wins-with-warning *(recommend — simplest, surfaces the persistence-conflict UX)* vs. field-level merge *(richer but heavier)*. Lean LWW + a visible "X also editing" banner; revisit if it feels too lossy.
2. **Rules engine expression format** (M6): a small JSON predicate DSL *(recommend — keeps rules as editable data, feeds the configurator too)* vs. hardcoded TS evaluators *(faster to write, fails the "Admin edits without deploy" requirement)*. Lean JSON DSL shared with M5.
3. **Self-serve vs. LO-assisted entry point** (M1/M5): support both from the start *(recommend — the permission/state model already covers it; it's mostly routing)* vs. LO-only first. Lean both, borrower draft + LO co-edit.
4. **Dataset scale for the pipeline** (M8): 1k vs 5k seeded applications. Lean 5k to actually stress windowing/pagination; generate via a seed script.

## Proposed build slices

See `/backlog/317-exercise-app-loan-origination/` for the agent-ready slice breakdown (this report is the requirements source those slices draw from).
