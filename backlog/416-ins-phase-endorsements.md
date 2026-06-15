---
type: idea
locus: exercise-app
workItem: story
size: 5
status: resolved
parent: "318"
dateOpened: "2026-06-12"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: demos/auto-insurance/domain/endorsement.ts + types/app/app.css (S5 endorsements)
tags: [exercise-app, auto-insurance, endorsement, re-rate, lifecycle, phase]
---

# Phase S5 — endorsements (mid-term change)

Functional phase of exercise app B ([#318](/backlog/318-exercise-app-auto-insurance-lifecycle/)).
Add/remove a vehicle or driver, change coverages or address → re-rate the remaining term (proration),
produce an endorsement record, re-issue docs. Role-gated; audited; a lifecycle sub-flow. See the
[requirements PRD](/reports/2026-06-12-exercise-app-auto-insurance-requirements/) (M6). **Consumes:**
lifecycle, rating (S0), audit.

## Progress (2026-06-15, resolved)

Added the endorsement (mid-term change) sub-flow to exercise app B:

- **`domain/endorsement.ts`** (pure core) — an applicable-change registry (add/remove Collision & Comprehensive coverage, add/remove a driver, change garaging territory), `previewEndorsement` (re-rate a clone + **prorate** the 6-month premium delta over the unexpired term via `remainingFraction`), and `applyEndorsement` (mutate the policy, append an immutable `Endorsement` record + audit entry, **re-issue** the declarations page + ID cards). Role-gated via `canEndorse` (agent/underwriter) — the Web Guards stand-in (PLATFORM-GAP #289).
- **`domain/types.ts`** — `Endorsement` / `EndorsementChange` types + `endorsements?` on `Policy`.
- **`app.ts`** — `renderEndorsement(p)` on an in-force policy: a picker whose options carry each change's prorated impact, an apply button, and the endorsement history; the apply handler reuses the rating engine (#411), appends to the Web Audit trail, and re-renders. The policy STATE stays in-force — an endorsement is a within-state sub-flow (Web Lifecycle owns the state machine).
- **`app.css`** — endorsement section styling (mirrors `.bind-body`).

**Reuse, not new bypass:** consumes the already-conformant lifecycle / rating / audit standards (no active standard-bypass; the only GAP is the pre-existing draft `notification`).

**Verified:** `tsc` 0 errors in the demo; `check:standards` green; `check:app-conformance` compliant (92%, 0 FAIL); live on :3000 — selecting an in-force policy shows the picker with prorated deltas (e.g. "Remove Collision coverage (−$234 prorated)"), applying records the endorsement (history 0→1), no console errors.
