---
kind: decision
parent: "1848"
status: open
dateOpened: "2026-07-10"
preparedDate: "2026-08-15"
tags: [enterprise, saas, account-model, org, seat, role, policy, plateau-app, placement]
---

# Enterprise SaaS account controls — account/org/seat/role model + precedence-policy placement (shape fork)

Roll-under of the enterprise epic #1848 (SaaS analog of #2372's fleet-policy precedence layer). Verified
against the live tree (2026-08-15): plateau-app carries **zero** account/org/seat/role substrate today —
`plateau:src/main.ts:117`'s `AuthState = { user: { name, email, role: string } | null, isLoggedIn }` is a
single simulated user with a bare role *string*, no org entity, no membership list, and no per-user
settings surface at all (`plateau:mocks/api/me/GET.json`'s `organization: "Acme Corp"` field isn't even in
the real `AuthState` type — it's a stray mock fixture, not modeled anywhere). So the card's original
framing — "overrides per-user settings on org-owned accounts" — presumed infrastructure that does not
exist; the account/org/seat/role model is the first thing to build, not a policy layered onto something
already there. This mirrors #1850's finding for the sibling telemetry item (plateau-app had zero telemetry
substrate, which flipped that item's locus) — same discipline, applied here.

## Why a decision, not a story (checklist item 2/4)

Card carried `size: 13` (self-declared >8 — an instruction to slice, not a size) and its own `## Next`
already named the correct move: `/prepare` then `/slice`. Below are the account/org/seat/role model's real
forks — data-model home and precedence mechanism — plus one settled placement note, none of which can be
picked silently. Ratifying the forks is what turns this into a `blockedBy`-chained set of buildable stories.

## Forced invariant — build order (not a fork)

A precedence-override layer needs two things that neither currently exist: an org-policy source, and a
per-user setting to override. Building both in one monolithic slice is not a coherent alternative to
sequencing — there is nothing to test "override" against until both exist. **Forced: the account/org/seat/
role model (who is a member, what seats exist, what role each member holds) ships first as its own slice;
the precedence-override layer (#2372's shape — org policy > per-actor setting > default) is a follow-on
slice, scoped only once the model exists AND at least one real overridable per-user setting ships in
plateau-app** (today there is none — no settings/preferences surface exists anywhere in `plateau:src` or
`plateau:packages`, grepped). This also means the card's suggested reuse target
(`we:analytics/dev-metrics.ts`'s `DevMetricsPolicy`) has nothing to attach to yet in plateau-app; it is
confirmed real and fully built (`we:analytics/dev-metrics.ts:136` +
`fui:plugs/webanalytics/devMetrics.ts:211` `resolveDevMetricsPolicy`), just not the layer this item's first
slice needs — see Fork 2.

## Fork 1 — data-model home: bespoke plateau-app schema vs. extending `webpermissions`

**Fork exists because** WE already ships a declared role/permission-scope contract
(`we:permissions/contract.ts`, #1699/#379/#178: `Role`, `PermissionScope`, `RoleGrant`, `PermissionModel`)
and reuse-vs-rebuild is a live open question, not a slam dunk either way.

- **(a) — RECOMMENDED. A new, plateau-app-owned schema** (`Organization`, `Seat`, `Member`, `OrgRole`),
  purpose-built for platform tenancy/billing. `webpermissions` models **app-domain RBAC** — field-,
  action-, state-, and ownership-scoped permissions *inside one conformant app's own business domain* (its
  worked example is loan-officer/underwriter/processor, #379's exercise-app A model). "Who is a paying seat
  on my Plateau account and what can they do in the billing/admin console" is a different axis: platform
  tenancy on a **served, credential-holding product**, which `we:docs/agent/platform-decisions.md
  #constellation-placement` rule 1 already routes to Plateau, not a WE-owned open type. Forcing one schema
  to carry both business-domain RBAC and platform tenancy would bend `webpermissions` past what #1699/#379
  ratified it to scope — and today `webpermissions` has zero real consumers in plateau-app to begin with
  (its only user is the unrelated exercise-app loan demo, #379), so reuse buys no shared consumer, only a
  scope collision.
  - **Distinguishing this from #1850's opposite ruling:** #1850 put the *dev-metrics precedence mechanism*
    in WE+FUI, explicitly rejecting plateau-app ("a fleet-wide policy mechanism is not a single product's
    concern"). That doesn't contradict Fork 1(a): #1850's subject was a cross-product **mechanism** (any
    WE-conformant app might want enterprise-override precedence over one setting); this fork's subject is
    **roster data** — which humans are members of *this one hosted product's* account, credential-bound to
    Plateau specifically. A mechanism generalizes across self-hosted consumers; a customer's seat roster
    does not. (Fork 2 below is where the mechanism question repeats, and there the answer again favors
    reusing WE/FUI-owned infrastructure — consistent with #1850, not opposed to it.)
  ```ts
  // plateau:packages/saas/src/accounts/schema.ts (new)
  export interface Organization { readonly id: string; readonly name: string; readonly seatLimit: number; }
  export interface Seat { readonly id: string; readonly orgId: string; readonly memberId: string | null; }
  export type OrgRoleId = 'owner' | 'admin' | 'billing' | 'member';
  export interface Member { readonly id: string; readonly orgId: string; readonly email: string; readonly role: OrgRoleId; }
  ```
- **(b) Extend `webpermissions`'s `Role`/`PermissionScope`/`RoleGrant`** to also carry org-tenancy roles
  (add an `'owner'|'admin'|'billing'|'member'` role set into the same `PermissionModel`). Cheaper reuse of
  an already-typed shape, but conflates two concerns the ratified contract was scoped to keep apart — a
  future in-app role (e.g. `underwriter`) and a platform role (e.g. `billing-admin`) would sit in the same
  `roles` array with no way to tell which layer a given `Role` governs.

**Known occurrences:** every SaaS platform that separates "who can act on the platform account" from "who
can act inside a customer's own app domain" keeps the two role sets apart — GitHub org roles
(owner/admin/member) are a different axis from a repo's own CODEOWNERS/branch-protection roles; Vercel
Team roles (owner/member/billing) are separate from an app's own auth; AWS Organizations' management-account
roles are separate from an account's own IAM roles.

**Skeptic:** SURVIVES-WITH-AMENDMENT (classification/merit/statute checked; the amendment — citing
`constellation-placement` rule 1 and distinguishing this from #1850's opposite-locus ruling — is folded in
above). **Screen:** clear — a real WE-contract-vs-product-schema placement call; the business-domain-RBAC
vs. platform-tenancy distinction is a semantic-clarity merit that holds even at zero build cost.

## Fork 2 — precedence-resolution mechanism (for the follow-on override-layer slice): reuse `webpolicy`'s PDP vs. a bespoke `DevMetricsPolicy`-style resolver

**Fork exists because** the card names one existing precedent (`DevMetricsPolicy`) but a closer, already
fully-built precedent exists that the card's author didn't check: `we:webpolicy/contract.ts`'s
`PolicyRuleSet` (#1077/#406, DMN decision-table meta-schema) already carries a **`scope?: string`** field
documented as "optional context/tenant scope this ruleset binds to" (`we:webpolicy/contract.ts:58`) — built
for exactly a tenant-scoped precedence shape — and its PDP/PEP engine is fully implemented with a
proof/audit chain, not just a contract: `fui:webpolicy/enforcement.ts`, `fui:webpolicy/proof.ts` (tested,
`fui:webpolicy/__tests__/enforcement.test.ts`, `fui:webpolicy/__tests__/proof.test.ts`).

- **(a) — RECOMMENDED. Reuse `webpolicy`'s DMN PDP/PEP.** Express "org policy overrides member setting X"
  as a `PolicyRuleSet` scoped to the org id; `HitPolicy: 'PRIORITY'` naturally expresses "org row wins over
  member row wins over default row" without a bespoke resolver per setting. Free proof/audit chain — which
  the plateau-app pricing page already promises the Enterprise tier ("Governance, ownership + approval
  workflows", `plateau:packages/saas/src/marketing/pricing.ts:55`) at no extra engineering cost, since the
  engine already ships that. This keeps the *mechanism* choice in WE/FUI-owned infrastructure, consistent
  with #1850's ruling that a precedence mechanism is a cross-product concern, not a single product's own
  code.
  ```ts
  // one ruleset per overridable setting, org-scoped
  const twoFactorPolicy: PolicyRuleSet = {
    id: 'require-2fa', version: '1', scope: orgId, hitPolicy: 'PRIORITY',
    inputs: ['org.require2fa', 'member.wants2fa'],
    rules: [
      { when: [{ input: 'org.require2fa', op: 'eq', value: true }], then: [{ name: 'verdict', value: 'enforced' }], priority: 2 },
      { when: [{ input: 'member.wants2fa', op: 'eq', value: true }], then: [{ name: 'verdict', value: 'enabled' }], priority: 1 },
    ],
    default: 'disabled',
  };
  ```
- **(b) A bespoke narrow resolver mirroring `DevMetricsPolicy`** (a fixed 3-state precedence hand-coded per
  setting, `we:analytics/dev-metrics.ts:136`). Faster for a single boolean-ish setting — which is exactly
  what it was scoped for (#1850: one setting, dev-metrics consent) — but the account-controls surface this
  item names is explicitly multi-setting ("org/seat/role... policy" plural), and hand-coding a 3-tier
  resolver per setting reinvents what the already-shipped, already-conformance-tested PDP does generically.

**Known occurrences:** AWS Organizations' Service Control Policies are exactly this shape — a declarative,
tenant-scoped policy document that overrides an account's own IAM permissions, evaluated with an explicit
precedence/combination rule — the same shape DMN hit policies generalize.

**Skeptic:** SURVIVES (classification/merit/statute/citations checked against the live `fui:webpolicy/` and
`we:analytics/dev-metrics.ts` sources; only a trivial line-number correction was needed, applied above).
**Screen:** clear — consumer-visible consequence (a real audit/proof chain vs. none), a genuine merit
difference that survives even at zero build cost.

## Naming note — surface placement (settled, not a fork)

The card's own text says the home is "plateau-app hosted control-plane," and a folder named exactly that
already exists at `plateau:packages/saas/src/control-plane/` — but it is verified to be the **Self-Driven
Project's own internal governance dashboard** (epic #666/#674 — autonomy ladder, gate enforcement,
escalation inbox, audit trail for how the Plateau *project itself* is governed:
`plateau:packages/saas/src/control-plane/dashboard.ts`, `plateau:packages/saas/src/control-plane/audit-view.ts`,
`plateau:packages/saas/src/control-plane/escalation-inbox.ts`,
`plateau:packages/saas/src/control-plane/trip-planner.ts`), not a customer-facing multi-tenant admin
console. There is no live second option here (the skeptic + fresh-context screen both confirmed the
"alternative" is definitionally wrong, not merely worse), so this is recorded as a naming note rather than
a ranked fork: **land the account/org/seat/role admin surface in a new sibling package directory** (e.g.
`plateau:packages/saas/src/accounts/`), never inside the existing `control-plane/`, to avoid conflating two
unrelated meanings of "control plane" under one folder name and one import graph.

## Recommended path at a glance

| Fork | Recommended default | Confidence |
|---|---|---|
| **1 · data-model home** | (a) bespoke plateau-app `Organization`/`Seat`/`Member`/`OrgRole` schema, not an extension of `webpermissions` | High |
| **2 · precedence mechanism** | (a) reuse `webpolicy`'s DMN PDP/PEP (already built, tenant-`scope`-aware) over a bespoke resolver | Med-high |

## Graduation (on ratification)

Re-slices into a `blockedBy` chain, mirroring #092's shape: **account/org/seat/role model + basic admin
CRUD (Slice 1, plateau-app only, new `accounts/` surface per the naming note)** → **at least one real
per-user setting to make the override concrete (prerequisite; may already exist by pickup time)** →
**precedence-override layer reusing `webpolicy` (Slice 2, `blockedBy` Slice 1)**. Slice 1 alone is likely
still `size > 8` (data model + seat assignment + role CRUD + a minimal admin UI) and should be sized/split
at `/slice` time, not guessed here.
