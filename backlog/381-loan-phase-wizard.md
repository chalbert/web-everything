---
kind: story
locus: exercise-app
size: 8
status: resolved
parent: "317"
dateOpened: "2026-06-12"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: demos/loan-origination/wizard/ (S3 1003 application wizard on the stepper block; native + cross-field validation; conformance.json stepper standard)
tags: [exercise-app, loan-origination, wizard, validation, phase]
---

# Phase S3 — borrower 1003 application wizard

Functional phase of exercise app A ([#317](/backlog/317-exercise-app-loan-origination/)) — the big UI
slice. Multi-step, resumable wizard mirroring the URLA sections (loan/property, borrower, employment/income,
assets, liabilities, REO, declarations, demographic) with repeating sections and conditional/cross-field
validation. See the [requirements report](/reports/2026-06-11-exercise-app-loan-origination-requirements/)
(M1). Drives the **validation** intent, **stepper** block, and **input** intent (mostly draft → WE work).

## Progress

- **2026-06-15 — built (exercise app A).** The `/application` module is no longer a routed stub — it now
  mounts the S3 1003 wizard, built platform-first on the WE **stepper** block:
  - `we:demos/loan-origination/wizard/applicationWizard.ts` — the working-state model + pure cross-field /
    conditional validators (`validateStep`: address-history ≥ 24mo, down-payment ≤ price, financed-amount
    sanity, self-employment income, assets cover down-payment, "yes" declaration needs an explanation) +
    `buildDraftApplication` (assembles a `draft`-state 1003).
  - `we:demos/loan-origination/wizard/applicationWizardView.ts` — the URLA sections as `[data-step]` panels,
    field bindings, repeating sections (employment / assets / liabilities / former addresses with
    add/remove), conditional declaration explanations + REO note, and the **`StepperBehavior`** wiring whose
    `canAdvance` gate runs native `checkValidity()` (the native-first per-control floor) + the cross-field
    rules, blocking advance and surfacing messages in a `role="alert"` region. `flow-complete` assembles the
    draft + shows a summary.
  - Wired into `we:app.ts` (`/application` route → skeleton + mount on entry) + wizard styles in `we:app.css`.
  - **Conformance:** `stepper` declared in `we:conformance.json` → conformant (active block, evidence
    `StepperBehavior`); `check:standards` + `check:app-conformance` both green (92%, 12/13, 0 FAIL,
    compliant). The validation/input intents are `draft`: the native constraint-validation floor is
    native-first (not a gap), and the richer cross-field form-validation runtime is recorded as a **Layer-2
    candidate standard** (the WE work S3 surfaces) — not a forced GAP, since native + app-domain rules don't
    bypass an active standard.
  - **Verified live** on :3000 (Playwright): 6 steps render, an empty required field blocks Next with the
    native message, valid input advances to Borrower, no console errors.
  - graduatedTo: `demos/loan-origination/wizard/` (the S3 1003 wizard on the stepper block).
