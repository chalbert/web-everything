---
type: idea
locus: exercise-app
workItem: epic
status: resolved
parent: "317"
dateOpened: "2026-06-12"
dateResolved: "2026-06-15"
graduatedTo: none
tags: [exercise-app, loan-origination, permissions, identity, phase]
---

# Phase S1 — identity, roles & field/action/state permission model

Functional phase of exercise app A ([#317](/backlog/317-exercise-app-loan-origination/)). Borrower / loan
officer / processor / underwriter / admin roles with **field-, action-, and state-scoped** permissions
(state-scoped editing, walled-off HMDA fields, action-scoped decision authority, ownership-scoped pipeline).
See the [requirements report](/reports/2026-06-11-exercise-app-loan-origination-requirements/) (Permissions).
Drives the unbuilt **webpermissions/webidentity** projects (#009/#012) — likely a WE-surface gap.

## Sliced into a storied epic (2026-06-15, `/slice 379`)

The **2026-06-14 re-size 5 → 13** rationale ("must stand up a permission model *and* an identity/roles
model that drive two **unbuilt** WE projects — webpermissions #009, webidentity #012") is now **stale**:
both standard surfaces have since shipped. The **web-identity thin intent** is live
([intents.json](/intents/web-identity/) — graduated from #012/#482, and its own copy names #379 as a
near-term consumer), the cross-cutting `permission` browser-API intent is live (#009/#457 — a *different*
concern, Permissions-API state, not app RBAC), and the **Guard protocol** + access-control member are
live (#272/#178). The S2 lifecycle (#380, resolved) already carries **role-scoped transitions** (each
edge's `actor`). So #379 is **no longer cross-project standard-building — it's pure app-side consumption**
of two shipping surfaces, and it cleaves along exactly those two surfaces (the constellation's own
factoring: *identity produces an auth-state signal; Guard consumes it as a predicate*).

Analysis: [reports/2026-06-15-backlog-split-analysis.md](/reports/2026-06-15-backlog-split-analysis.md).

### Slices (DAG: #378 ✓ + #380 ✓ → #686 → #687)

- **[#686](/backlog/686-loan-s1a-identity-roles-auth-state-signal-consume-web-identi/)** — S1a: identity
  & roles + auth-state signal (consume the web-identity intent). Replaces the `ACTOR` placeholder at
  `app.ts:95` with a real signed-in user + role set + a demo role-switcher. Story · 3. Immediately
  batchable.
- **[#687](/backlog/687-loan-s1b-field-action-state-permission-predicates-consume-gu/)** — S1b:
  field/action/state permission predicates (consume the Guard protocol). State-scoped edit/read-only,
  field-scoped HMDA wall-off, action-scoped authority, + defines the ownership predicate (applied to the
  pipeline later in S10). Task. Blocked on #686.

The inflated `size: 13` is superseded by the two slices (≈6 total).
