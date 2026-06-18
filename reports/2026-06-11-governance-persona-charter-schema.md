# Governance Persona Roster + Charter Schema — prior-art survey

**Date:** 2026-06-11
**Grounds:** backlog [#166](../backlog/166-governance-persona-roster-charter-schema.md) — canonicalize the stakeholder personas (developer, designer, manager, translator, analyst/QA, security, legal) as **one persona family** with **one charter schema**, surfaced through two lenses (the plateau-app `/profiles` governance charter and the dev-browser toggle-map, [#141](/backlog/141-dev-browser-vision/)).
**Companion research description:** `we:src/_includes/research-descriptions/governance-persona-charter-schema.njk`

This survey gathers prior art from organizational-governance and access-control practice — RACI/RASCI, design-system governance models, the four gate types, and SaaS RBAC custom-role patterns — so the four open questions the item raised (shareable profiles, free/paid tiering, one registry vs. per-product, gate enforcement) become bold-defaulted forks grounded in established vocabulary rather than coined terms. The existing charter machinery already on disk (`plateau:plateau-app/src/profiles/profiles.ts`) is the substrate every fork reshapes.

---

## What already exists (the substrate)

The charter schema is **already implemented and rendering** at plateau-app `/profiles` — this is not a greenfield design. Seven personas are authored as pure-data `Profile` objects:

- **`Profile`** (`plateau:plateau-app/src/profiles/profiles.ts:85`) — `id`, `name`, `title`, `accent`, `glyph`, `mission`, `signals[]`, `reviewAreas[]`, `artifactsOwned[]`, `escalation`.
- **`ReviewArea`** (`plateau:profiles.ts:17`) — `title`, `platformArea` (the join key, `plateau:profiles.ts:22`), `why`, `reviews[]`, `gates[]`, `manages[]`.
- **`Gate`** (`plateau:profiles.ts:34`) — `trigger`, `blocksDeployment: boolean` (`plateau:profiles.ts:39`), `sla`.
- **`Signal`** (`plateau:profiles.ts:45`) — `label`, `value`, `status: 'ok' | 'watch' | 'risk'`.
- The roster itself is a hand-authored array, `export const profiles: Profile[]` (`plateau:profiles.ts:941`), with all seven personas inline.

`platformArea` is typed as a closed union (`PlatformArea`, `plateau:profiles.ts:54`) pinning each review area to a real Plateau domain (`apps`, `dependencies`, `intents`, `deployment`, …), so a profile is a *lens over the platform*, not a parallel structure. This is the shape the forks must either keep, share, or enforce — they do not redesign it.

Two facts from `plateau:profiles.ts` are load-bearing for the forks:

1. **`blocksDeployment` is already a boolean on every gate** (`plateau:profiles.ts:39`, set `true`/`false` across ~30 gate definitions) — but it is purely *descriptive* today; nothing reads it to actually block anything. Fork 4 is about whether that boolean ever becomes an enforced signal.
2. **The roster is a static TypeScript array** (`plateau:profiles.ts:941`) compiled into plateau-app. Fork 3 is about whether it stays there or graduates to a shared data home both lenses read.

---

## Prior art

### 1. RACI / RASCI — decision-rights vocabulary, not access control

RACI (Responsible, Accountable, Consulted, Informed) is the canonical organizational-governance model for cross-functional decision rights. It answers *who owns a decision* — exactly the framing the charter's `reviewAreas` + `gates` express ("this role reviews X, holds a sign-off gate on Y"). RASCI adds **Support**. Key property for us: RACI is **per-deliverable**, mapping a role to a task, and a well-formed matrix has **exactly one Accountable** per decision. That maps directly to the charter's one-owner-per-gate shape and is the natural vocabulary for the gate `trigger`.

RACI is *not* an access-control model — it confers no system permissions. This matters: the WE personas are a **governance/decision-rights** family (who reviews and approves), not an authorization family (who *may* do a thing). Conflating the two would be the classic RACI↔RBAC category error.

### 2. Design-system governance — the four gate types (directly reusable)

The design-system governance literature (Brad Frost, zeroheight, Cabin) converges on a small fixed vocabulary that maps cleanly onto the charter's `gates`:

- **Governance models:** *centralized*, *federated*, *hybrid*. The charter's "one canonical roster, two lenses" is a **centralized** model with federated *consumption* — relevant to Fork 1 (can orgs add their own personas?).
- **Gate types (the key find):** the literature names exactly four —
  - **Advisory** — logged, no block.
  - **Validating** — signed off, allows continuation.
  - **Blocking** — must pass; halts on fail.
  - **Escalating** — routes to a higher authority on flag.

  The current schema collapses all of this into a single `blocksDeployment: boolean` (`plateau:profiles.ts:39`) — i.e. only Advisory (`false`) vs. Blocking (`true`). This four-way enum is the grounded vocabulary for Fork 4's enforcement axis, and `escalation` (already a `Profile` field, `plateau:profiles.ts:104`) is the Escalating route.
- **System Owner is one person, not a committee** — reinforces the single-Accountable / single-owner-per-gate rule.

### 3. SaaS RBAC custom roles — the clone-a-template guardrail (grounds Fork 1)

The multi-tenant SaaS RBAC literature (WorkOS, Aserto, PropelAuth, Azure custom roles) converges on a pattern that answers the item's "shareable / team-templated profiles?" question:

- **Most tenants never need custom roles** and stay on stable built-in defaults; only enterprise customers remix.
- The strong guardrail: **a new role must clone an existing template, then modify** — preventing orgs from inventing taxonomies from scratch. This is the natural answer to "can an org publish its own persona?": yes, but as a **derivation of a canonical built-in**, not a free-form parallel roster.
- **Role inheritance** (child inherits parent's permissions) is a tree model; for personas the lighter analog is *clone + override*, since personas compose review areas rather than nest.
- Custom roles are **stored in a directory and shareable across subscriptions** — the org-published / team-templated case, gated to advanced tenants.

### 4. Free/paid tiering (grounds Fork 2)

The SaaS pattern: **built-in defaults are universally available; custom/derived roles are an enterprise-tier capability.** Combined with #141's monetization principle ([#141:24](/backlog/141-dev-browser-vision/) — local = free, remote/server = paid; a local product *may* carry a commercial license): the seven canonical personas ship free (they are content, not server-bearing); **org-authored custom personas and shareable team templates are the paid/enterprise affordance** (they imply a publish/share plane, which is server-shaped). This keeps tiering aligned with the cost-flat principle: the free tier never takes on server cost.

---

## How the four open questions become forks

| Open question (item) | Becomes | Default |
|---|---|---|
| Shareable / team-templated profiles? | Fork 1 — roster model | **Canonical built-ins + clone-to-derive custom personas** (RBAC template guardrail) |
| Free/paid tiering interaction | Fork 2 — tiering | **Built-ins free; custom/shareable personas are the paid affordance** |
| One registry or per-product? | Fork 3 — registry shape | **Shared data home read by both lenses; not a WE standard entity** |
| Gate enforcement | Fork 4 — enforcement | **Keep descriptive now; widen `blocksDeployment` boolean to the 4-type gate enum as the forward-compatible seam** |

Full crux, options, tradeoffs, and rejected branches for each fork are in the decision file (`we:backlog/166-...md`). Defaults follow the platform's standing principles: **most-flexible default** (custom personas allowed, gated by tier), **bias toward separation** (roster data lives in its own home, not baked into either lens), and **native/established vocabulary** (RACI decision-rights framing, the four gate types, the clone-a-template guardrail) over coined terms.

---

## Sources

- Responsibility assignment matrix (RACI/RASCI) — [Wikipedia](https://en.wikipedia.org/wiki/Responsibility_assignment_matrix); [Atlassian](https://www.atlassian.com/work-management/project-management/raci-chart); [Cornell IT — RACI/RASCI definitions](https://it.cornell.edu/it-service-management/raci-and-rasci-definitions)
- Design-system governance models + gate types — [Brad Frost — A Design System Governance Process](https://bradfrost.com/blog/post/a-design-system-governance-process/); [zeroheight — governance models](https://help.zeroheight.com/hc/en-us/articles/36474270188699-Design-system-governance-models-and-which-is-right-for-your-organization); [Cabin — Design System Governance That Sticks](https://cabinco.com/design-system-governance-that-sticks/)
- SaaS RBAC custom roles / clone-a-template / sharing — [WorkOS — multi-tenant RBAC](https://workos.com/blog/how-to-design-multi-tenant-rbac-saas); [Aserto — custom roles](https://www.aserto.com/blog/implementing-custom-roles-in-your-saas-application); [PropelAuth — RBAC for B2B SaaS](https://www.propelauth.com/post/guide-to-rbac-for-b2b-saas); [Azure custom roles](https://learn.microsoft.com/en-us/azure/role-based-access-control/custom-roles)
