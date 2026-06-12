---
type: idea
workItem: story
size: 5
status: open
parent: "314"
dateOpened: "2026-06-11"
tags: [exercise-app, healthcare, patient-intake, permissions, privacy, requirements]
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
