---
type: idea
locus: exercise-app
workItem: task
parent: "379"
status: resolved
blockedBy: ["686"]
dateOpened: "2026-06-15"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: demos/loan-origination/domain/permissions.ts
tags: []
---

# Loan S1b — field/action/state permission predicates (consume Guard protocol)

Slice S1b of #379, blocked on S1a (#686 — the role signal to gate on). Map the loan app's permission scopes onto the shipping **Guard protocol** (#272/#178): **state-scoped** editing (borrower edits only in draft, read-only once submitted), **field-scoped** HMDA wall-off (visible to UW/Admin, hidden from the LO pricing view, never read by the rules engine), **action-scoped** authority (UW-only decision/condition-clear, Admin-only threshold edit, LO may quote not approve), and **define** the ownership predicate `ownsApplication(role, app)` (the pipeline UI that *applies* it is S10, out of scope). Home: `we:demos/loan-origination/domain/permissions.ts` + `we:app.ts`. No state-machine work — reads lifecycle state shipped via #380.

Demoable on S1a + the 5k seeded apps across states: as different roles, fields hide/show, edit↔read-only flips by state, restricted actions are gated.

## Progress

- **2026-06-15 — built + verified.** New `we:demos/loan-origination/domain/permissions.ts` maps the three
  scopes onto the shipping Guard protocol (`we:guard/provider.ts`, #178) as a `LoanGuardProvider`
  (`CustomGuardProvider`):
  - **state-scoped editing** — `editability(actor, app)`: borrower edits only their own `draft`,
    read-only once submitted; staff edit only in the states they work; terminal is read-only to all.
  - **field-scoped HMDA wall-off** — `fieldVisibility` + `isHmdaField`: `demographic` visible to
    Underwriter/Admin (and the borrower entering their own), hidden from the Loan-Officer pricing view;
    `isEngineReadableField('demographic') === false` encodes "never a rules-engine input".
  - **action-scoped authority** — `ACTION_AUTHORITY` + `actionAllowed`: UW-only decision/condition-clear,
    Admin-only threshold edit, LO may quote not approve.
  - **ownership** — `ownsApplication(actor, app)` (borrower-on-app / staff-by-assignment / admin-all).
  - The provider resolves `field:<id>` / `action:<id>` / `edit` regions at the `enter` event; deny
    *strategy* (hide vs forbid) is the member's concern, exposed via `denyOutcomeFor` (the #288 minimal
    `{allow,reason}` seam is not overloaded). `leave` is the exit-guard member's, always allowed here.
- **Wired** in `we:app.ts`: a `CustomGuardRegistry` with the provider registered as default, exposed as a
  live resolvable seam (`globalThis.__loanPermissions`). The pipeline UI that *applies* each decision is
  slice S10 (out of scope) — this ships the predicates + provider, not the applier.
- **Verified:** `we:demos/loan-origination/domain/__tests__/permissions.test.ts` (18 tests) — the demoable
  across roles/states/fields/actions + the provider resolution + ownership + engine wall-off. Added a
  `demos/**/__tests__/**` include to `we:vitest.config.ts` so exercise-app domain logic runs in the suite.
  Locus gate green: `check:standards` 0 errors; `check:app-conformance` **compliant** (0 FAIL; the lone
  GAP is the pre-existing `notification` draft, not this work). No standard bypassed → no GAP tag needed.
- **No state-machine work** — reads `Application.state` shipped by #380; built on the S1a role signal (#686).
