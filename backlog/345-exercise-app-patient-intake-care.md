---
kind: story
locus: exercise-app
size: 5
status: resolved
parent: "314"
dateOpened: "2026-06-11"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: "reports/2026-06-14-exercise-app-patient-intake-requirements.md (scoped + sliced S0-S7; build = follow-on phase cards under #345)"
tags: [exercise-app, healthcare, patient-intake, permissions, privacy, requirements]
relatedReport: reports/2026-06-14-exercise-app-patient-intake-requirements.md
crossRef: { url: /backlog/314-flagship-exercise-apps/, label: "Flagship exercise apps (#314)" }
---

# Exercise app E — Patient intake & care coordination: derive requirements & scope the build

Candidate **E** from the flagship-exercise-apps epic ([#314](/backlog/314-flagship-exercise-apps/)).
Derive a full, complex requirements set for a **patient intake & care-coordination** app —
registration, insurance eligibility, scheduling, clinical intake forms, **care plans** (task tree),
and referrals. The standout exercise is **strict permissions / privacy** (PHI → webpermissions,
governance personas) plus **hierarchical clinical coding** (tree-select over ICD/SNOMED-like
taxonomies). Fidelity to real clinical standards or HIPAA is optional — just full and complex enough
to push the platform. This story ends when the requirements are documented well enough to scope the build.

## What to derive

- **Registration & eligibility:** patient demographics, insurance capture & eligibility check.
- **Scheduling:** appointment booking, provider availability, reschedule/cancel.
- **Clinical intake:** structured intake forms (history, meds, allergies) with conditional logic.
- **Care plans:** care-plan task tree (goals → tasks), assignment, status tracking.
- **Referrals:** outbound referral creation & tracking.
- **Actors & roles + privacy:** patient, front-desk, clinician, care-coordinator — with PHI access boundaries and a permission/consent model.

## Surfaces it stresses (per #314 matrix)

webidentity / webpermissions (primary — PHI boundaries), tree-select (clinical coding & care-plan
tree, primary), collection-ops / pagination (patient lists, schedules), validation (intake forms),
persistence (in-progress intake), scheduling UI.

## Requirements source strategy

Derive from first principles, lightly anchored to a generic intake form set and a small clinical
taxonomy slice — complex through the permission model and hierarchy, not through real clinical data.

## Done when

A requirements doc exists (actors & PHI permission model, registration/scheduling/intake/care-plan/
referral flows, clinical taxonomy slice, data model) detailed enough to break the build into
agent-ready slices.

## Progress

- **Resolved 2026-06-14.** Derived the full requirements + scope for app E (patient intake & care
  coordination) → [we:reports/2026-06-14-exercise-app-patient-intake-requirements.md](../reports/2026-06-14-exercise-app-patient-intake-requirements.md),
  mirroring the loan / auto-insurance / telecom-CPQ PRD shape. **Two headline exercises:** the strict
  **PHI permission / privacy / consent model** (role × resource × patient-relationship, redact/deny-by-
  default, break-the-glass + audit — primary webpermissions/webidentity + governance-persona exercise)
  and **hierarchical clinical coding** (tree-select over a synthesized deep ICD/SNOMED-like taxonomy —
  primary tree-select exercise; recurs as the care-plan goal→task tree). Covers registration & eligibility,
  scheduling, conditional clinical intake, the care-plan task tree, and referrals; three lifecycles
  (encounter / referral / care-plan-task); a platform-surface mapping (already-shipped standards consumed,
  permissions + tree-select the new work it drives); proposed visual register (clinical/accessibility-
  forward); and **8 proposed build slices S0–S7** → follow-on functional-phase cards under #345 (not
  scaffolded here — this story ends at the scoped, sliced requirement set, per the DoD; /exercise-app or
  /slice creates the phase cards). `relatedReport` registered. Gate: `check:standards` green,
  `check:app-conformance` compliant (no standard bypassed — requirements-only).
