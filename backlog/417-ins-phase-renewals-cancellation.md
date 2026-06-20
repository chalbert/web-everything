---
kind: story
locus: exercise-app
size: 5
status: resolved
parent: "318"
dateOpened: "2026-06-12"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: demos/auto-insurance/domain/renewal.ts + guards/app/app.css (S6 renewals & cancellation)
tags: [exercise-app, auto-insurance, renewal, cancellation, lifecycle, phase]
---

# Phase S6 — renewals & cancellation

Functional phase of exercise app B ([#318](/backlog/318-exercise-app-auto-insurance-lifecycle/)). Renewal
offer (re-rate at term end) → accept/non-renew; cancellation (non-pay / insured-request / UW) with
proration + reason; reinstatement. All guarded lifecycle transitions. See the
[requirements PRD](/reports/2026-06-12-exercise-app-auto-insurance-requirements/) (M7). **Consumes:**
lifecycle, Web Guards, audit.

## Progress (2026-06-15, resolved)

Added the end-of-term + termination flows to exercise app B, all as **guarded Web Lifecycle transitions**:

- **`we:domain/renewal.ts`** (pure core) — `renewalOffer` (re-rate the next term), `acceptRenewal` (carry into a new term, stays in-force; resets per-term payment/issuance), `recordNonRenewal` (→ expired), `recordCancellation` (earned/unearned split + prorated refund; **short-rate on non-pay**, pro-rata on insured-request/UW), and reinstatement. Reuses the S5 `remainingFraction` so endorsement + cancellation share one proration basis.
- **Guards made real** — the previously default-true `cancel-reason` and `reinstate` Web Lifecycle guards now resolve through `cancellationRecorded` / `reinstateEligible` (the Web Guards stand-in, PLATFORM-GAP #289): in-force → cancelled requires a recorded reason; lapsed → in-force requires a lapsed policy.
- **`we:domain/types.ts`** — `Cancellation` / `Renewal` / `CancellationReason` types + `cancellation?` / `renewals?` on `Policy`.
- **`we:app.ts` / `we:app.css`** — `renderPolicyActions(p)`: in-force shows the renewal offer (re-rated, accept / non-renew), a cancellation reason picker, and a lapse action; lapsed shows reinstate + cancel; cancelled shows the refund summary. Handlers fire the guarded transitions, append to Web Audit, and notify (#421).

**Verified:** `tsc` 0 errors; `check:standards` green; `check:app-conformance` compliant (92%, 0 FAIL); live on :3000 — cancellation produces the cancelled badge + prorated refund, lapse→reinstate returns the policy to in-force, renewal-accept is audited; no console errors.

<!-- original "Consumes" line retained below -->
**Consumes:**
lifecycle, Web Guards, audit.
