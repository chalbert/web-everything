---
kind: story
size: 5
status: resolved
locus: webeverything
relatedTo: ["178", "379", "009", "1645"]
dateOpened: "2026-06-23"
dateStarted: "2026-06-23"
dateResolved: "2026-06-23"
graduatedTo: "we:permissions/contract.ts"
tags: []
---

# webpermissions contract — declared role / permission-scope model types in @webeverything

The declared authorization model the permission/identity simulator (#1645/#1695) enumerates and the access-control gate consults: roles, permission scopes, and the affordances each scope is declared to gate, as introspectable type-only contract entries in @webeverything/contracts. Ruled by #178 (declarative authorization / feature-flag gate) and #379 (identity, roles and field/action/state permission model) — both resolved as DECISIONS with graduatedTo none, so the contract was specified but never built; #009 folded the Permissions domain into webnotifications, which shipped only push-delivery (#1064), leaving the permission half unbuilt. Mirrors the webidentity contract shape (#1060); webidentity supplies identity shapes, this supplies the role/scope half. Type-only WE contract slice; the runtime authorization gate and the dev-browser RACI lens (#1636) consume it, they do not own it.

## Progress (resolved 2026-06-23, batch-2026-06-23-1689-1500)

Shipped mirroring the webidentity contract (`we:identity/contract.ts`) — a pure, compile-erased type-only
module + the published-package surface:

- **`we:permissions/contract.ts`** — the declared authorization model: `Role`; `PermissionScopeKind`
  (`field`/`action`/`state`/`ownership`, the #379 dimensions); `Affordance` (a gated target by kind+id);
  `PermissionScope` (a named capability gating affordances); `RoleGrant` (role→scope ids); `PermissionModel`
  (roles + scopes + grants — what the #1645/#1695 simulator enumerates and the gate consults); and
  `PermissionQuery` / `PermissionDecision` (the gate's eval point + verdict, `deny`-safe-default).
- **`we:contracts/permissions.ts`** type-only re-export + `./permissions` entry in
  `we:contracts/package.json` (the published surface, like `./credential-management`).

Grounded in the ratified model (#379: borrower/loan-officer/processor/underwriter/admin roles with
field-/action-/state-/ownership-scoped permissions). Explicitly the **app-RBAC** model, distinct from the
browser Permissions-API `permission` intent (#009/#457, a different concern). Type-only — no runtime
(the authorization gate + #1636 RACI lens are the impl consumers). Typecheck clean.

**Gate note (not this changeset):** the WE gate's two reds are the same concurrent-session externals as
this batch's other WE items (`we:reports/2026-06-23-1704-split-analysis.md`, stale `we:AGENTS.md`); neither
names a `we:permissions/` file. Stepped over per the batch external-red diagnosis.
