---
type: idea
locus: exercise-app
workItem: story
size: 3
parent: "379"
status: resolved
dateOpened: "2026-06-15"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: demos/loan-origination/domain/identity.ts (web-identity signal + act-as role switcher)
tags: []
---

# Loan S1a — identity & roles + auth-state signal (consume web-identity intent)

Slice S1a of #379. Stand up a real signed-in user for `demos/loan-origination`: a user account carrying a role set (borrower / loan-officer / processor / underwriter / admin) + an auth-state signal read from the shipping **web-identity intent** shape (not ad-hoc local session). Replace the hardcoded `ACTOR={role:'underwriter'}` placeholder at `we:app.ts:95`, add a demo **role-switcher** (act-as), and point the lifecycle's existing per-edge `actor` check at this signal. Home: `we:demos/loan-origination/domain/identity.ts` + `we:app.ts`. App-side consumption only — the web-identity intent already shipped (#012/#482); prereqs S0 #378 + S2 #380 both resolved.

Demoable: switch the acting role → the chrome reflects who you're signed in as, and the available lifecycle moves change to match the role (vs the fixed underwriter today).

## Progress

Resolved 2026-06-15. exercise-app locus (commit → webeverything). App-side consumption of the web-identity shape — the demoable holds.

- **`we:demos/loan-origination/domain/identity.ts`** (new) — realizes the **web-identity intent** shape (the UX-only seam, #012/#482, which is provider-less by design, so the app consumes the *shape*, not a runtime that doesn't exist): `AuthState` / `IdentityDescriptor` / `WebIdentitySignal` (mirroring we:intents.json#web-identity's Interface Protocol), plus the loan role model (`LoanRole` = borrower / loan-officer / processor / underwriter / admin, `ROLE_LABEL`) and a signed-in `LoanUser` (D. Okafor) carrying the full role set with a switchable `activeRole`. Exposes `identitySignal` (the `WebIdentitySignal` `state`/`identity` getters + `activeRole` / `setActiveRole` / `subscribe`) and `currentActor()` (the live lifecycle/audit actor shape).
- **`we:app.ts`** — removed the hardcoded `const ACTOR = { role: 'underwriter' }`; every prior use now reads live from the signal: the lifecycle fire (`{ role: identitySignal.activeRole }`), the audit `actor` (`currentActor()`), and `decidedBy` (`currentActor().id`). `availableMoves` is now **scoped to the active role** (was surfaced across all roles), so the offered moves change with the act-as role. The static user-chip became `renderIdentityChip()` — the signed-in identity (from the signal, titled with the `authState`) + an `act-as` `<select>` — mounted + kept in sync like the notification region; a topbar `change` handler calls `setActiveRole`, and a `fillPipeline` subscriber re-paints the open loan's trace so its moves re-scope.
- **`we:app.css`** — `.act-as` switcher styling to fit the dark topbar.

No standard bypassed → no GAP tag (web-identity is a UX-only intent; realizing its shape is the intended consumption, and `check:app-conformance` stayed green with no new GAP/FAIL).

Verification: `tsc --noEmit` clean for the touched files; `npm run check:standards` = 0 errors; `npm run check:app-conformance` = **92% compliant, 0 FAIL, 1 GAP** (the pre-existing `notification` draft, unchanged). Live probe (Playwright, :3000 `/demos/loan-origination/pipeline`): the chip reads `web-identity authState: signed-in` with all 5 act-as roles; selecting an underwriting-state loan and switching the role re-scopes the offered moves (underwriter → `suspended`/`declined`, borrower & processor → none), every visible move's `data-actor` matches the active role, **zero console errors**.
