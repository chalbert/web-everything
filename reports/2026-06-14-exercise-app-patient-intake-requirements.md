# Patient intake & care coordination — exercise-app requirements (app E, #345)

**Point:** Full, complex requirements for a healthcare **registration → eligibility → scheduling → clinical
intake → care plan → referral** app whose defining difficulties are a **strict PHI permission / privacy
model** (role × resource × patient-relationship access, consent-gated) and **hierarchical clinical coding**
(tree-select over ICD/SNOMED-like taxonomies). The most direct exercise of the **webpermissions /
webidentity** and **tree-select** paradigms, and a flagship exercise app (#345), a forcing function for Web
Everything. Fidelity to real clinical standards or HIPAA is optional — requirements need only be full and
complex enough to stress the platform through the permission model and the hierarchy, not through real
clinical data.

Tracked by epic [#314](/backlog/314-flagship-exercise-apps/) (candidate E). Companion to the loan-app
(`reports/2026-06-11-exercise-app-loan-origination-requirements.md`), auto-insurance
(`reports/2026-06-12-exercise-app-auto-insurance-requirements.md`), and telecom-CPQ
(`reports/2026-06-14-exercise-app-telecom-cpq-requirements.md`) PRDs. This story ends at a scoped, sliced
requirement set; the build is the follow-on functional-phase cards.

## Scope

One synthesized **outpatient clinic** intake & care-coordination flow — generic enough to avoid real
clinical fidelity, rich enough that the **PHI access model** and the **clinical-code / care-plan trees** are
the hard parts. The app spans registration & insurance eligibility, appointment scheduling, structured
clinical intake (with conditional logic), a care-plan task tree, and outbound referrals — across four
clinical actors with strict, consent-gated PHI boundaries. Built **platform-first**: every UI/behavior need
resolves against Web Everything (consume active blocks/intents; where a surface is draft/uncodified, that
gap *is* the WE work this app drives — see [exercise-app-workflow.md](../docs/agent/exercise-app-workflow.md)).

**Visual register (proposed): clinical / healthcare** — a calm, high-legibility, accessibility-forward
register (generous spacing, restrained color, status-driven) distinct from the enterprise-finance (loan),
modern-SaaS insurtech (auto), and consumer telco-commerce (telecom) registers already claimed, proving the
platform reskins via a `theme-<register>` token layer. (Per the per-app-register program rule; final
register assignment defers to that program.)

## Actors & roles

- **Patient** — completes their own registration, insurance capture, intake forms, sees their appointments
  and care plan; constrained to *their own* record only.
- **Front-desk / registrar** — registers patients, captures & checks insurance eligibility, books/reschedules
  appointments; sees demographics + scheduling, **not** clinical detail (intake answers, diagnoses).
- **Clinician** (provider) — reads the full record of *patients on their panel / today's schedule*, completes
  clinical intake review, assigns diagnoses (clinical coding), authors care plans, creates referrals.
- **Care coordinator** — manages care-plan tasks and referral tracking across a panel; sees clinical summary +
  care plan, with a narrower clinical-detail scope than a clinician.

### Permission model (the webpermissions / webidentity exercise — headline 1)

A **role × resource × relationship** matrix, the standout difficulty. Access is gated not only by role but by
the actor's **relationship to the patient** (treating clinician / assigned coordinator / registering desk) and
by **consent**:

- **PHI minimum-necessary:** the front desk sees demographics + insurance + scheduling but **not** intake
  answers, diagnoses, or care-plan clinical notes; a clinician sees full clinical detail only for patients on
  their panel/schedule; a coordinator sees clinical *summary* + tasks, not raw intake free-text.
- **Relationship-scoped:** a clinician cannot open an arbitrary patient's chart — only one with a care
  relationship (on-panel, scheduled-with, or an explicit break-the-glass with reason + audit).
- **Consent-gated:** sensitive categories (mental-health, substance-use, reproductive) require an explicit
  consent flag to surface even to an otherwise-authorized role; absence redacts the section.
- **Patient self-scope:** a patient reads/writes their own intake and sees their own plan, never another's.

Every cross-boundary access (break-the-glass, sensitive-category view) is **reason-coded + audited** (Web
Audit). Transitions are role-and-relationship-scoped and guarded (composes **Web Guards** + **Web
Lifecycle** + **governance personas**). This is the most direct exercise of **webpermissions / webidentity**
and the governance-persona charters.

## Domain glossary

Patient, Demographics, Insurance plan / coverage, Eligibility check, Provider, Panel, Appointment, Slot,
Encounter, Intake form, Intake answer, Condition / problem, Clinical code (ICD/SNOMED-like, hierarchical),
Allergy, Medication, Care plan, Goal, Care-plan task, Assignment, Referral, Consent, Sensitive category,
Reason code, Audit event.

## The hierarchical clinical-coding model (the tree-select exercise — headline 2)

Diagnoses, problems, and care-plan categories are assigned from **deep hierarchical taxonomies** (ICD/SNOMED-
like), the part that makes this clinical, not a flat dropdown. The exercise:

- **Tree-select over a deep taxonomy** — type-ahead search that reveals the path to a match, lazy-expandable
  branches, select a leaf (or an explicitly-allowed parent), show the full ancestor path as the chosen label.
- **Synthesized taxonomy slice** — a few hundred nodes across a handful of chapters (e.g. endocrine →
  diabetes → type/complication), deterministic seed, deep enough (4–6 levels) to stress expansion, search,
  and path rendering without real terminology licensing.
- **Care-plan category tree** — goals and tasks are themselves organized under a (shallower) clinical-category
  tree, so **tree-select recurs** as both a coding control and a plan-structuring control.
- **Multi-select + constraints** — a problem list is a multi-select of leaves; some codes imply a required
  follow-up category (a soft, explainable rule, not a hard block).

This drives the **tree-select** standard (deep hierarchy, search-to-path, lazy load, leaf-vs-parent
selectability) as the surface this app most pushes — the likely new WE work it drives.

## Lifecycle / state machine (the Web Lifecycle exercise)

**Encounter lifecycle:** `registered → eligibility-checked → scheduled → (intake-in-progress ↔ saved) →
intake-complete → clinician-review → coded → care-plan-drafted → (active ↔ amended) → closed`; a no-show
sends `scheduled → no-show → (rescheduled → scheduled)`. **Referral lifecycle:** `drafted → sent →
(accepted → scheduled → completed) | declined`. **Care-plan-task lifecycle:** `open → in-progress →
(blocked ↔ in-progress) → done | cancelled`. Guards: intake-complete requires all required answers valid;
clinician-review requires a treating relationship; coding requires clinician role; a referral send requires
patient consent for external disclosure.

## Functional requirements by module

### M1 — Registration & eligibility (validation exercise)
Capture patient demographics, contact, and insurance (payer, member id, group); run a synthesized
**eligibility check** (eligible / inactive / needs-info + reason). Drives **validation** (structured fields,
required/format), **status-indicator** (coverage state), **persistence** (resume a part-done registration).

### M2 — Scheduling (scheduling-UI / collection-ops exercise)
Provider availability as bookable slots; book / reschedule / cancel; a day/agenda view for the front desk;
no-show handling. Drives **scheduling UI**, **collection-ops** (the schedule list + filters), **lifecycle**.

### M3 — Clinical intake (conditional-form / validation exercise)
Structured intake forms — history, medications, allergies, symptoms — with **conditional logic** (a "yes"
reveals follow-ups; pediatric vs adult branches). Save-and-resume for a long form. Drives **validation**
(conditional + cross-field), **persistence**, **disclosure** (progressive sections), **autofocus**.

### M4 — Clinical coding & problem list (tree-select exercise — primary)
Assign diagnoses/problems from the hierarchical taxonomy (§ coding model): search-to-path tree-select, multi-
select problem list, allergy & medication coding. Drives **tree-select** (primary), **collection-ops** (the
problem/medication lists), **decision-trace** (why a code-implied follow-up was suggested).

### M5 — Care plan (task-tree / master-detail exercise)
Author a care plan as a **goal → task tree** (categories from the care-plan tree), assign tasks to actors,
track status, due dates. Master-detail: plan overview ↔ task detail. Drives **tree-select** (plan structure),
**master-detail**, **collection-ops**, **lifecycle** (task states), **status-indicator**.

### M6 — Referrals (lifecycle / consent exercise)
Create an outbound referral (specialty from a category tree, reason, attachments-by-reference), track its
lifecycle, require patient **consent** before send. Drives **lifecycle**, **permissions/consent**, **audit**,
**master-detail**.

### M7 — Access, consent & audit (permissions exercise — primary)
The cross-cutting headline surface: the role × relationship × consent gate (§ permission model), break-the-
glass with reason, sensitive-category redaction, and the audit timeline of every consequential / cross-
boundary access. Drives **permissions**, **webidentity**, **governance personas**, **audit-timeline**,
**decision-trace**.

## Business-rule catalog (rules-as-code home)

- **Access rules:** role × resource × patient-relationship × consent → permit / redact / break-the-glass +
  reason code (the minimum-necessary + relationship + consent model above).
- **Eligibility:** payer + plan + member status → eligible / inactive / needs-info + reason.
- **Intake conditional logic:** answer → revealed/required follow-up sections (pediatric/adult, symptom
  branches).
- **Coding rules:** a selected code may imply a required/suggested follow-up category (soft, explainable).
- **Care-plan / referral guards:** intake-complete validity, treating-relationship for review, consent for
  external referral.

Each evaluation (an access decision, an eligibility result, a code-implied follow-up) is a versioned,
explainable **DecisionRecord** (decision-trace standard) — an access *denial* with its reason is itself a
record.

## Data model (entities)

Patient (Demographics, Contact), Coverage (payer, plan, member, eligibility status), Provider, Panel,
Slot, Appointment, Encounter (status), IntakeForm (schema), IntakeAnswer[], Problem[] (coded), Allergy[],
Medication[], ClinicalCodeTaxonomy (hierarchical nodes), CarePlan (Goal[] → Task[]), CarePlanTask
(status, assignee, due), Referral (status, consentRef), Consent (category, granted), ReasonCode[],
AuditEvent[].

## Cross-cutting / non-functional

PHI **minimum-necessary** as a first-class default (deny/redact-by-default, not allow-by-default); save-and-
resume (webpersistence) for long intake; a11y as a primary register concern (this is the accessibility-
forward app); deterministic seed taxonomy + patient set (no `Math.random`) so coding, access decisions, and
conditional logic are reproducible; the clinical theme-token layer.

## Platform-surface mapping (what each module exercises)

| Module | WE surfaces driven |
|---|---|
| M1 registration & eligibility | validation, status-indicator, persistence |
| M2 scheduling | scheduling UI, collection-ops, lifecycle |
| M3 clinical intake | validation (conditional + cross-field), persistence, disclosure, autofocus |
| M4 clinical coding & problem list | **tree-select** (primary), collection-ops, decision-trace |
| M5 care plan | tree-select, master-detail, collection-ops, lifecycle, status-indicator |
| M6 referrals | lifecycle, permissions/consent, audit, master-detail |
| M7 access, consent & audit | **permissions** (primary), webidentity, governance personas, audit-timeline, decision-trace |

Already-shipped standards the loan + insurance + telecom apps drove (lifecycle, status-indicator, audit,
decision-trace, master-detail, collection-ops, pagination, validation, persistence, permissions) are
**consumed** here — patient-intake is their next consumer, a cross-app conformance check. The two surfaces
this app most pushes are the **PHI permission/consent model** (role × relationship × consent, redact-by-
default, break-the-glass) and **tree-select over a deep clinical taxonomy** — the likely new WE work it
drives.

## Settled decisions

- **Domain:** one synthesized outpatient-clinic intake & care-coordination flow; clinical fidelity optional,
  permission + hierarchy complexity mandatory.
- **Visual register:** clinical / healthcare, accessibility-forward (proposed; defers to the register
  program).
- **Headline exercises (two):** the strict PHI permission/privacy/consent model **and** hierarchical clinical
  coding (tree-select) — the reasons this app exists.
- **Minimum-necessary default:** access is deny/redact-by-default; every grant is an explicit, audited rule.
- **Build order:** access model + taxonomy seed + patient set first (proves the permission gate + the tree),
  then registration/eligibility, scheduling, intake, coding, care plan, referrals.

## Proposed build slices (→ functional-phase cards under #345)

S0 access model + reason codes + audit seam + synthesized clinical taxonomy + patient/provider seed ·
S1 registration & eligibility (validation) · S2 scheduling · S3 clinical intake (conditional forms +
persistence) · S4 clinical coding & problem list (tree-select — the headline) · S5 care plan (goal→task
tree, master-detail) · S6 referrals (lifecycle + consent) · S7 access/consent/audit surfacing (the
permission headline, woven through every prior slice).
