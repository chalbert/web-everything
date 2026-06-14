---
type: decision
workItem: story
size: 5
status: resolved
dateOpened: "2026-06-07"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: none
preparedDate: "2026-06-11"
relatedReport: reports/2026-06-11-governance-persona-charter-schema.md
tags: [personas, profiles, governance, plateau, dev-browser, review-approve-manage, dev-experience, vision]
crossRef: { url: /backlog/141-dev-browser-vision/, label: "Profiles: predefined personas (#141)" }
---

# Canonical governance-persona roster + charter schema — one family, two lenses

The platform's stakeholder **personas** (developer, designer, manager, translator, analyst/QA, security, legal) are referenced in two places — the plateau-app `/profiles` governance charter and the dev-browser toggle-map ([#141](/backlog/141-dev-browser-vision/)) — but four design questions about the model are unsettled. This item canonicalizes them as **one persona family** with **one schema**, surfaced through **two lenses** (the **charter drives the toggle-map** — what a role cares about determines which surfaces it lights up), and resolves the four open forks below.

**Digest.** Grounded in the *already-implemented* charter schema on disk (`plateau-app/src/profiles/profiles.ts` — seven `Profile` objects rendering at `/profiles`) plus a prior-art survey of RACI/RASCI decision-rights, design-system governance gate types, and SaaS RBAC custom-role patterns ([report](../reports/2026-06-11-governance-persona-charter-schema.md)). The four forks: roster model defaults to **canonical built-ins + clone-to-derive custom personas** (RBAC template guardrail); tiering defaults to **built-ins free, custom/shareable personas paid**; registry shape defaults to a **shared data home both lenses read** (not a WE standard entity); gate enforcement defaults to **stay descriptive now but widen `blocksDeployment` to the four-type gate enum** as the forward-compatible seam.

## Axis-framing

The charter is **not greenfield** — it is implemented and rendering. The schema is `Profile` ([profiles.ts:85](../../plateau-app/src/profiles/profiles.ts#L85)) → `ReviewArea` ([profiles.ts:17](../../plateau-app/src/profiles/profiles.ts#L17)) pinned to a real platform domain via `platformArea` ([profiles.ts:22](../../plateau-app/src/profiles/profiles.ts#L22)) → `Gate` ([profiles.ts:34](../../plateau-app/src/profiles/profiles.ts#L34)) carrying `blocksDeployment: boolean` ([profiles.ts:39](../../plateau-app/src/profiles/profiles.ts#L39)), and the roster is a hand-authored array `export const profiles` ([profiles.ts:941](../../plateau-app/src/profiles/profiles.ts#L941)) with all seven personas inline. Two on-disk facts are load-bearing: `blocksDeployment` is already a boolean on ~30 gates but is **purely descriptive** (nothing reads it), and the roster is a static TypeScript array **compiled into plateau-app** (the dev-browser cannot import it without coupling). The four forks decide how this existing lens is **customized, tiered, homed, and enforced** — they reshape it, they do not redesign it. The personas are a *decision-rights / governance* family (RACI: who reviews and approves), **not** an authorization family (RBAC: who may act) — conflating the two would be a category error.

**Framing (2026-06-14): a persona is a *preset*, not a closed group.** A persona is a front-facing label over broader composable concepts — a named preset bundling *preferences* + *which surfaces light up* (the lens sense, consistent with the RACI-not-RBAC line above). This is why Fork 1·A (clone-to-derive) is natural: a new persona is just a new preset, and a *local* custom persona is client-side config with no server cost (informs Fork 2's free/paid line). Whether personas are a first-class platform concept that this governance roster is merely one instance of is carried as its own investigation in [#564](/backlog/564-personas-as-a-first-class-agile-concept/) — does not block this item.

### Recommended path at a glance

Ratify all four rows, or override just the one you'd change. The **confidence** column says where judgment is actually needed vs. where to nod.

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 · roster model** | canonical built-ins + clone-to-derive custom personas | free-form org rosters *(rejected)* / built-ins only *(rejected)* | **High** — SaaS RBAC template guardrail |
| **2 · tiering** | built-ins free; custom/shareable personas are the paid affordance | tier-gate the built-in personas too *(rejected)* | **Med-high** — composes #141 cost-flat principle |
| **3 · registry shape** | shared data home both lenses read (plateau-app owned) | WE standard entity *(rejected)* / stay a static TS array *(rejected)* | **High** — product data, not a standard |
| **4 · gate enforcement** | descriptive now; widen boolean → 4-type gate enum | enforce in CI now / leave boolean as-is | **Med** — enum is safe; *when* to enforce is the open part |

## Fork 1 — roster model: can an org define its own personas?

**Crux.** The item asks whether personas are "purely product-defaults, or can an org publish its own ('release-manager', 'support')." Today the roster is a fixed seven-element array ([profiles.ts:941](../../plateau-app/src/profiles/profiles.ts#L941)) with no extension seam. The SaaS RBAC literature gives a precise answer to this exact question.

- **(A — recommended) Canonical built-ins + clone-to-derive custom personas.** The seven personas are the canonical roster; an org may author its own only by **cloning a built-in template and overriding** — the established multi-tenant RBAC guardrail ("a new role must clone an existing template, then modify"), preventing free-form parallel taxonomies. A custom persona is a *derivation* (same `Profile` schema, overridden `reviewAreas`/`gates`), so both lenses keep working unchanged. Most orgs never customize and stay on the defaults. Cost: an extension/clone mechanism to build (a paid affordance — see Fork 2).
- **(B) Built-ins only — personas are product-defaults, full stop.** Simplest; no extension surface. Rejected: the item explicitly inherits the shareable/team-templated requirement from #141, and "release-manager"/"support" are real org roles the seven canonical personas don't cover.
- **(C) Free-form org rosters — an org defines arbitrary personas from scratch.** Maximum flexibility. Rejected: SaaS practice shows free-form taxonomies fragment and drift; the clone-a-template guardrail (A) gets the flexibility without the fragmentation, and keeps every persona schema-valid by construction.

**Default → A.** Canonical built-ins + clone-to-derive custom personas. Most-flexible default that stays governed (the restriction — must derive from a canonical template — is the deliberate guardrail, not a limitation).

*Rejected:* B (too rigid; ignores the inherited #141 requirement) · C (free-form drift; loses the template guarantee).

## Fork 2 — free/paid tiering: does persona scope gate behind tiers?

**Crux.** The item asks whether "profile scope gates behind tiers" (inherited from #141). #141 sets the monetization rule — local = free, remote/server = paid ([#141:24](/backlog/141-dev-browser-vision/)). The question is which side of that line each persona capability falls on.

- **(A — recommended) Built-ins free; custom/shareable personas are the paid affordance.** The seven canonical personas are **content** (static data, no server) → free, universally available. **Custom (Fork 1·A) and shareable/team-templated** personas imply a publish/share plane (server-shaped: storing, distributing, syncing an org's roster) → the **paid/enterprise** affordance. This is the standard SaaS split (built-in defaults free, custom roles enterprise-tier) *and* exactly the #141 cost-flat principle: the free tier never takes on server cost.
- **(B) Tier-gate the built-in personas too** (e.g. security/legal only on a paid plan). Rejected: the canonical personas are the product's *value demonstration* and carry no server cost — gating them behind a tier contradicts the cost-flat principle and kneecaps the free funnel (#141's extension-first free tier).

**Default → A.** Built-ins free; custom + shareable/team-templated personas are the paid affordance. The tiering line falls exactly on the server-cost boundary #141 already drew.

*Rejected:* B (gates zero-server-cost content; breaks the free funnel and the cost-flat principle).

## Fork 3 — registry shape: one registry or per-product?

**Crux.** The item asks whether the roster "lives in WE as a standard entity (like intents/protocols), or stays a plateau-app data file with the dev-browser importing it." Today it's a static TS array compiled into plateau-app ([profiles.ts:941](../../plateau-app/src/profiles/profiles.ts#L941)) — which the dev-browser **cannot import without coupling** to the SaaS app, yet the "charter drives the toggle-map" relationship requires both lenses to read one roster.

- **(A — recommended) Shared data home both lenses read; plateau-app owned, dev-browser imports.** Extract the roster from the compiled TS array into a data file (JSON/data module) both products read. Resolves the coupling (dev-browser reads the data, not the SaaS app's internals) while keeping a single source of truth so the two lenses stay projections of one roster. Owned by plateau-app (the governance plane), not WE.
- **(B) WE standard entity (like intents/protocols, with a `/profiles` tile index).** Rejected: personas describe **org roles and governance**, not **browser/platform behavior** — they are product data, not a browser-aligned standard. WE's scope is standard artifacts only ([npm scope mirrors layer](/MEMORY)); a persona roster has no conformance/interop story and no place in intents.json/protocols.json. Bias toward separation: governance data belongs to the governance product.
- **(C) Stay a static TS array in plateau-app.** Rejected: blocks the dev-browser lens entirely (can't import without coupling), defeating the "two lenses, one roster" goal.

**Default → A.** Shared data home both lenses read, owned by plateau-app — **not** a WE standard entity. Per the constellation layering, governance/product data lives in the product, never in the standard.

*Rejected:* B (personas aren't a browser standard; wrong repo/layer) · C (blocks the second lens).

## Fork 4 — gate enforcement: descriptive charter or enforced check?

**Crux.** The item asks whether gates "ever become *enforced* checks (CI/deploy integration), or remain a documented charter." Today every gate carries `blocksDeployment: boolean` ([profiles.ts:39](../../plateau-app/src/profiles/profiles.ts#L39)) — set `true`/`false` across ~30 gates — but nothing reads it; it is purely descriptive. The design-system governance literature names four gate types (Advisory / Validating / Blocking / Escalating); the current boolean collapses that into just Advisory-vs-Blocking.

- **(A — recommended) Keep gates descriptive now, but widen the boolean to the four-type gate enum.** Replace `blocksDeployment: boolean` with `gateType: 'advisory' | 'validating' | 'blocking' | 'escalating'` (the established vocabulary; `escalation` ([profiles.ts:104](../../plateau-app/src/profiles/profiles.ts#L104)) is already the Escalating route). This is a **schema change with no enforcement change** — gates stay documentation today, but the seam is forward-compatible so enforcement can arrive later without a breaking migration. Most-flexible: the richer enum strictly subsumes the boolean.
- **(B) Wire enforcement into CI/deploy now** (a `blocking` gate actually fails a pipeline). Rejected for *now*: enforcement is a large, separate build (CI integration, gate-state storage, sign-off UX, override/waiver flow) that overlaps the access-control gate work in [#178](/backlog/178-access-control-authorization-gate/); premature to commit the roster decision to it. Left as a deliberate follow-on once the schema (A) lands.
- **(C) Leave the boolean as-is.** Rejected: loses the Validating and Escalating distinctions the literature (and the personas' real gates — many are sign-off, not hard-block) already need, and bakes in a lossy two-state model right before a likely enforcement build.

**Default → A.** Stay descriptive, but widen `blocksDeployment` → the four-type gate enum so enforcement (a separate build, candidate follow-on aligned with #178) can land later without a schema break.

*Rejected:* B (enforcement is a separate large build; premature to couple here) · C (lossy; loses Validating/Escalating right before the enforcement seam is needed).

## Preserved context — the roster and schema (as implemented)

| Persona | Title | Primarily governs / cares about |
|---|---|---|
| Developer | Platform / App Engineer | Build & CI, dependencies, code standards, app health, traces & state |
| Designer | Design Systems Lead | Design system, components, design-drift, intents, visual conformance |
| Manager | Eng Lead / Platform Manager | Portfolio rollups: conformance, test health, throughput, productivity |
| Translator | Localization Manager | Translations/i18n, locale coverage, string drift, jurisdictional copy |
| Analyst / QA | Quality & Support Analyst | Test status, bug capture, rule coverage, repro fidelity, releases |
| **Security** | Application Security Engineer | Supply chain, third-party scripts, CSP, auth, secrets, MFE isolation |
| **Legal** | Legal, Privacy & Compliance Counsel | OSS licenses, privacy/consent, processors/DPAs, accessibility, IP, jurisdiction |

All seven are implemented as full charters in `plateau-app/src/profiles/profiles.ts` and render at `/profiles`. The charter schema (pure data):

- **Profile** — `id`, `name`, `title`, `accent`, `glyph`, `mission`, `signals[]`, `reviewAreas[]`, `artifactsOwned[]`, `escalation`.
- **ReviewArea** — `title`, `platformArea` (the join key to a real Plateau domain — a profile is a *lens over the platform*, not a parallel structure), `why`, `reviews[]`, `gates[]`, `manages[]`.
- **Gate** — `trigger`, `blocksDeployment` (Fork 4 widens this), `sla`.
- **Signal** — `label`, `value`, `status` (ok | watch | risk).

## Status

- ✅ Schema defined; all seven personas implemented and rendering at plateau-app `/profiles`.
- ✅ Four open questions reshaped into bold-defaulted forks (2026-06-11, prepared) — see report `reports/2026-06-11-governance-persona-charter-schema.md`.
- ✅ All four forks ratified (Forks 1/3/4 on 2026-06-11; Fork 2 on 2026-06-14).
- ✅ Graduated to builds: shared roster data home → [#565](/backlog/565-extract-governance-persona-roster-to-a-shared-data-home/); gate-type enum migration → [#566](/backlog/566-migrate-persona-gate-schema-blocksdeployment-boolean-to-four/); clone-to-derive + tiering → [#567](/backlog/567-clone-to-derive-custom-personas-with-local-free-share-paid-t/); CI enforcement follow-on → [#568](/backlog/568-enforce-blocking-persona-gates-in-ci-deploy-gate-enforcement/). Persona-as-concept investigation → [#564](/backlog/564-personas-as-a-first-class-agile-concept/).

## Resolution (complete) — 2026-06-14

All four forks ratified. The three model/shape/enforcement forks landed 2026-06-11; the pricing/monetization fork (tiering) landed 2026-06-14 (refined, see below). Graduated builds: [#565](/backlog/565-extract-governance-persona-roster-to-a-shared-data-home/) · [#566](/backlog/566-migrate-persona-gate-schema-blocksdeployment-boolean-to-four/) · [#567](/backlog/567-clone-to-derive-custom-personas-with-local-free-share-paid-t/) · [#568](/backlog/568-enforce-blocking-persona-gates-in-ci-deploy-gate-enforcement/).

- **Fork 2 — tiering (ratified 2026-06-14, refined to A-refined):** built-ins free; **local** custom personas (clone-to-derive) **free**; only the **share/sync/team-template plane** (publish, distribute, sync an org roster) is **paid**. The refinement over the prepared default: the line falls on *server cost*, not on "is it a premium-sounding feature." Local clone-to-derive is client-side config with zero marginal server cost, so it stays free (the cost-flat rule — cost scales ~linearly with revenue; prefer owned on-device fixed cost); paywalling it would be prioritization-in-fork's-clothing. The paid affordance is precisely the server-shaped capability, on the #141 boundary. Builds to [#567](/backlog/567-clone-to-derive-custom-personas-with-local-free-share-paid-t/). Also confirmed: a persona is a **preset, lens sense** (preferences + surfaces lit up), not RBAC permissions — the persona-as-first-class-concept question is carried to [#564](/backlog/564-personas-as-a-first-class-agile-concept/).

### Forks 1 / 3 / 4 — ratified 2026-06-11

- **Fork 1 — canonical built-ins + clone-to-derive custom personas**: the SaaS RBAC template guardrail gives the most-flexible default that stays governed — a custom persona is a derivation of the same `Profile` schema, so both lenses keep working and free-form taxonomy drift is prevented.
- **Fork 3 — shared data home both lenses read (plateau-app owned, NOT a WE standard entity)**: personas are governance/product data with no conformance/interop story, so per the constellation layering they live in the product; extracting the roster to a shared data file resolves the dev-browser coupling while keeping one source of truth.
- **Fork 4 — descriptive now; widen `blocksDeployment` boolean → the four-type gate enum (advisory/validating/blocking/escalating)**: a schema change with no enforcement change — the richer enum strictly subsumes the boolean and is forward-compatible, so CI enforcement (a separate large build aligned with #178) can land later without a breaking migration.
