---
type: decision
workItem: story
size: 3
status: resolved
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: none
preparedDate: "2026-06-14"
locus: plateau-app
relatedReport: reports/2026-06-14-persona-preset-primitive.md
tags: [personas, agile, methodology, governance, profiles, presets, dev-browser, plateau]
crossRef: { url: /backlog/166-governance-persona-roster-charter-schema/, label: "Governance-persona roster (#166)" }
---

# Personas as a first-class agile concept

> **Resolved 2026-06-14 — ratified as written.** All three rows stand:
> **Forced invariant** — a persona is a lens (RACI), never authorization (RBAC); if access ever
> follows a persona it is a *separate* PBAC mapping the persona references, owned by
> [#178](/backlog/178-access-control-authorization-gate/). **Fork 1 → A** — name the shared
> **pattern/vocabulary** ("persona = a named preset over composable concepts: preferences +
> surfaces-lit-up"); keep two separate homes (governance in plateau-app `/profiles`, agile-role in
> #563's playbook); do **not** build a unified runtime schema. **Fork 2 → A** — name "persona/preset"
> as #563's explicit role-switching primitive, as a documented methodology concept (not a built
> schema). Materialization spun off as **[#622](/backlog/622-document-the-persona-preset-primitive-as-a-named-platform-co/)**
> (one concept doc both lenses cite — satisfies both forks); Fork 2's naming also noted on #563.

No *unified* design exists yet — "persona" appears in two places (governance charters, [#166](/backlog/166-governance-persona-roster-charter-schema/); the agile roles one operator multiplexes, [#563](/backlog/563-ai-driven-agile-methodology-as-a-shareable-approach/)) but it's never been decided whether they're *one* primitive. Are both projections of **persona = a named preset over composable concepts** (preferences + surfaces-lit-up), not a closed group? Forks grounded in [`/research/persona-preset-primitive/`](/research/persona-preset-primitive/) ([report](../reports/2026-06-14-persona-preset-primitive.md)). Two forks + one forced invariant: unification depth → **name the shared pattern, NOT a unified schema**; methodology naming → **name "persona/preset" as #563's role-switching concept**; permission boundary is a **forced invariant — persona is a lens (RACI), never authorization (RBAC)**.

## Axis-framing

The concern decomposes into three orthogonal axes, each pinned to what's actually on disk. **(1) Unification depth** — how *much* the two lenses share. The governance lens is a *shipped, resolved* schema: `Profile` ([plateau:schema.ts:101](../../plateau-app/src/profiles/schema.ts#L101)) carrying `mission`/`signals`/`reviewAreas` (each pinned to a `platformArea`, [plateau:schema.ts:22](../../plateau-app/src/profiles/schema.ts#L22)) and `gates` typed to a four-value `GateType` ([plateau:schema.ts:48](../../plateau-app/src/profiles/schema.ts#L48), post-#566), with the roster a real array ([plateau:roster.ts:846](../../plateau-app/src/profiles/roster.ts#L846)). Two on-disk facts bound the unification cost: this `Profile` has **no** `preferences`/`surfaces`/`toggleMap` field — it is a *governance charter*, not the generic "preferences + surfaces" preset this card abstracts — and the dev-browser "feature toggle map" lens it would share with ([#141:90](/backlog/141-dev-browser-vision/)) is **not yet built**. The agile-role lens ([#563](/backlog/563-ai-driven-agile-methodology-as-a-shareable-approach/)) has *no runtime at all* — its substrate is the methodology machinery (the `.claude/skills/*` role-handoff skills + `we:scripts/backlog.mjs` claim/resolve CLIs). **(2) Methodology naming** — whether #563 elevates "persona/preset" to a load-bearing named concept. **(3) Permission boundary** — whether a persona ever gates real access; #166 drew the RACI-not-RBAC line, this card re-examines it deliberately and against the access reference owned by [#178](/backlog/178-access-control-authorization-gate/).

### Recommended path at a glance

Ratify the invariant + both rows, or override just the one you'd change. The **confidence** column says where judgment is actually needed vs. where to nod.

| Decision | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **Forced invariant · permission boundary** | persona is a lens (RACI), never authorization; access is a *separate* mapping it may reference (PBAC) | fold permissions into the persona model *(category error — rejected)* | **High** — #166 + PBAC prior art |
| **Fork 1 · unification depth** | name the shared **pattern/vocabulary**; keep two separate homes | one unified runtime schema/registry *(rejected)* / treat as unrelated, no shared name *(rejected)* | **Med-high** — bias toward separation; no shared runtime |
| **Fork 2 · methodology naming** | name "persona/preset" as #563's explicit role-switching primitive (documented concept, not built schema) | leave it an informal metaphor | **Med** — soft call; the concept is load-bearing once named |

## Forced invariant — the permission boundary (a ratify, not a weigh)

**A persona is a lens, never an authorization primitive.** The item asks whether a persona should "ever carry real permissions." It should not: #166 already drew the **RACI** (who reviews/approves) vs **RBAC** (who may act) line and kept them separate, and the access-control survey confirms it. Even the access-bearing variant in the wild — **Persona-Based Access Control (PBAC)** — keeps the persona a *lens mapped onto* permission-roles via an explicit `entitlements` attribute (TrustBuilder): the persona "feeds RBAC when needed," it does not *become* RBAC; the canonical example is a *lens switch* (use the `staff` persona, then switch to `operator` to manage settings). So the supported shape is: **persona stays a lens; if access ever follows a persona, that is a separate RBAC/PBAC mapping the persona *references*** — authorization itself stays owned by [#178](/backlog/178-access-control-authorization-gate/). Folding permissions *into* the persona model is the category error #166 named — *that* branch is the broken one, which is why this is a ratify, not a fork.

## Fork 1 — unification depth: one schema, one pattern, or unrelated?

**Crux.** The item's core hypothesis is that the governance lens and the agile-role lens are "projections of one preset/role primitive." How much should they actually *share*? The governance `Profile` is shipped, resolved code with no preset/preferences field ([plateau:schema.ts:101](../../plateau-app/src/profiles/schema.ts#L101)); the agile-role lens has no runtime, only methodology machinery; and the third would-be projection (the dev-browser toggle-map, [#141:90](/backlog/141-dev-browser-vision/)) isn't built. So "share more" has a real, asymmetric cost.

- **(A — recommended) Name the shared *pattern/vocabulary*; keep two separate homes.** Make "persona = a named preset over composable concepts (preferences + surfaces-lit-up)" a first-class platform *concept* — a documented vocabulary both lenses cite — while the governance lens stays plateau-app data ([#166·Fork 3](/backlog/166-governance-persona-roster-charter-schema/)) and the agile-role lens stays a methodology concept ([#563](/backlog/563-ai-driven-agile-methodology-as-a-shareable-approach/)). This is the VS Code Profiles / CrewAI prior-art shape: a persona is a *thin label that bundles independently-owned concepts*, and both industry instances are kindred *patterns*, not a merged schema. Honours bias-toward-separation: the two recur independently and share no runtime, so the burden of proof is on combining — and it isn't met.
- **(B) One unified runtime schema/registry both lenses project from.** Maximally "DRY" — a single `Persona`/`Preset` type with governance and agile-role as views. *Rejected:* it would widen (or rebuild) shipping, resolved governance code to add preset/preferences fields it doesn't have, against a second lens that has *no runtime at all* — coupling for no interop gain (the minimize-lock-in / separation bias). No prior art fuses an agent-role persona and a governance charter into one schema.
- **(C) Treat them as unrelated — no shared name.** Cheapest. *Rejected:* it discards the genuine, prior-art-backed insight (#564's whole reason to exist) that both are the same *preset* pattern; naming the pattern is the value even when the homes stay separate.

**Default → A.** Name the shared pattern/vocabulary; keep two separate homes. The kinship is real and worth naming; the *implementation* stays decoupled.

*Rejected:* B (couples shipped code to a runtime-less lens; no interop gain) · C (throws away the load-bearing insight).

## Fork 2 — does the agile methodology name "persona/preset" as its role-switching primitive?

**Crux.** [#563](/backlog/563-ai-driven-agile-methodology-as-a-shareable-approach/) describes one operator multiplexing PO → BA → dev → QA via agents. Should "persona/preset" be the **explicit, named** role-switching primitive of that methodology, or stay an informal metaphor? The substrate is the skills + CLIs that already make role-handoff deterministic (`.claude/skills/*`, `we:scripts/backlog.mjs`), and the industry prior art is direct: CrewAI models each agent as a "configured LLM persona" (role + goal + backstory) — agile-style roles *are* named as personas in the field.

- **(A — recommended) Name it as a methodology concept (not a built schema).** Adopt "the operator *switches persona* (PO/BA/dev/QA)" as named, load-bearing vocabulary in #563's playbook — the conceptual bridge #563 already gestures at — grounded in the CrewAI role-persona prior art. It is a *documented concept*, consistent with #563 being a knowledge artifact, **not** a product, and with Fork 1·A (name the pattern, don't build a schema). Makes agent role-handoff legible without new code.
- **(B) Leave it an informal metaphor.** No load-bearing vocabulary; the kinship stays implicit. *Rejected (as the default):* #563 explicitly flags the persona bridge as worth naming, and an unnamed primitive can't be cited consistently across the playbook, #166, and #141 — but this is the genuine soft call, so it carries lower confidence than Fork 1.

**Default → A.** Name "persona/preset" as #563's explicit role-switching primitive, as a documented methodology concept.

*Rejected:* B (leaves a load-bearing concept unnamed; weakens the playbook's legibility) — the lower-confidence row.

---

## Context

### Per-fork classification (recorded)

Running the standard classification on every element resolves most of it the same way #166 did. **Which layer?** Neither lens is a Block/Intent/Protocol/Capability — both are *governance/product data + a methodology concept*, with **no browser-behaviour or conformance/interop story**, so neither belongs in WE's standard registries (intents/protocols). Per the constellation layering and [#166·Fork 3](/backlog/166-governance-persona-roster-charter-schema/), governance data lives in plateau-app and the methodology concept lives in #563's playbook. **Protocol or intent dimension?** Neither — no swappable-vendor interop need (a protocol would be lock-in for no gain). **Separate or combine?** The standing bias (separate; burden of proof on combining) is decisive for Fork 1 and is *unmet* by the unify-into-one-schema branch. **Most-permissive default?** Naming a shared pattern while keeping homes separate is the least-restrictive option that still captures the insight.

### The reframe — persona = preset, not group

A persona is **not a closed set of members** (RBAC group). It is a **front-facing label over broader composable concepts** — a named *preset* that bundles **preferences** (defaults/emphasis for a way of working) and **surfaces lit up** (which areas/views a role cares about — the dev-browser toggle-map lens, [#141](/backlog/141-dev-browser-vision/)). Because it's a preset, **new personas are just new presets** — clone a built-in, override, done (the clone-to-derive model ratified in #166·Fork 1; the same shape as VS Code Profiles). The seven shipped personas are simply the presets we ship, not an enumeration of allowed roles.

### Two lenses on one primitive

| Lens | Where | What the preset selects |
|---|---|---|
| **Governance personas** | plateau-app `/profiles` + dev-browser toggle-map ([#166](/backlog/166-governance-persona-roster-charter-schema/)) | what a role reviews/approves; which platform surfaces light up |
| **Agile-role personas** | the operating model ([#563](/backlog/563-ai-driven-agile-methodology-as-a-shareable-approach/)) | the mode the operator/agent occupies — PO, BA, dev, QA — when running the delivery loop |

The hypothesis: these are **projections of one preset/role primitive** — a persona is the unit you *switch into*, whether to govern a release or to do BA work this turn. Fork 1 decides *how much* that shared primitive is built vs. merely named.

### Relationship to #166

[#166](/backlog/166-governance-persona-roster-charter-schema/) settled the *governance* roster (model, home, gate enum, tiering) and is **resolved**. This card is **broader**: it asks whether the persona notion itself is a first-class platform concept that #166's governance roster is one instance of. It does not block #166; #166's resolved Fork 3 (shared data home, plateau-app owned) already pre-decides where the governance lens lives, which is why Fork 1·A keeps the homes separate rather than re-homing anything.
