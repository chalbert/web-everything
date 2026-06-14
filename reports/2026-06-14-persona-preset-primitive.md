# Persona as a First-Class Preset Primitive — prior-art survey

**Date:** 2026-06-14
**Point:** Persona = a named *preset* over composable concepts (preferences + surfaces-lit-up); the governance roster (#166) and the agile-role operating model (#563) are two lenses on that one notion — but prior art says **name the shared pattern, do not merge the two homes into one runtime schema**, and keep persona a *lens*, never an authorization primitive.
**Plan file:** (none — focused `/prepare 564`)
**Research page:** `/research/persona-preset-primitive/`
**Grounds:** backlog [#564](../backlog/564-personas-as-a-first-class-agile-concept.md) — investigate whether "persona" is a first-class platform concept of which #166's governance roster and #563's agile-role multiplexing are both projections.

---

## Question

#564 hypothesizes that two things the platform already talks about are projections of **one** primitive:

- **Governance personas** ([#166](../backlog/166-governance-persona-roster-charter-schema.md), resolved) — the seven stakeholder charters rendering at plateau-app `/profiles`; a preset selecting *what a role reviews/approves* and *which surfaces light up* (the dev-browser toggle-map lens, [#141](../backlog/141-dev-browser-vision.md)).
- **Agile-role personas** ([#563](../backlog/563-ai-driven-agile-methodology-as-a-shareable-approach.md), open epic) — the modes one operator multiplexes through (PO → BA → dev → QA) while running the delivery loop with agents.

The reframe the item asserts: a persona is **not a closed group (RBAC)** — it is a **front-facing label over broader composable concepts**, a named *preset* bundling preferences + surfaces. The questions: (1) is there one underlying schema both lenses project from? (2) does the agile model actually benefit from being modeled as switchable personas? (3) the permission boundary — lens-only forever, or does a persona ever gate real access? (4) should the role-switching primitive be named explicitly in the methodology?

#166 already surveyed the *governance* lens (RACI/RBAC, gate types, SaaS custom-role patterns). This survey adds the two angles #166 didn't need: the **preset/profile primitive** pattern and the **agentic role-persona** pattern, plus the **persona-vs-access-control** boundary.

## Recommendation (forks prepared for #564)

1. **Unification depth → name the shared *pattern*, not a unified runtime schema.** Document "persona = preset over composable concepts" as a first-class platform *vocabulary*, but keep the two lenses in **separate homes** (governance = plateau-app data per #166·Fork 3; agile-role = a methodology concept per #563). The bias-toward-separation default: the two recur independently and share no runtime, so a unified schema/registry is coupling for no interop gain. The value of #564 is *naming the primitive*, not merging the code.
2. **Permission boundary → lens-only, forever.** A persona is a decision-rights + preference lens (RACI), never authorization (RBAC). If access ever needs to follow a persona, that is a *separate* RBAC/PBAC mapping a persona may *reference* (the TrustBuilder "persona → entitlements" model) — never authorization folded into the persona itself. Access control stays owned by [#178](../backlog/178-access-control-authorization-gate.md).
3. **Agile-role lens → name it as a methodology concept, not a built schema.** Name "persona/preset" as #563's explicit role-switching primitive (the operator *switches persona* PO→BA→dev→QA), documented in the playbook — consistent with #563 being a knowledge artifact, *not* a product, and with unification-depth #1.

## Key Findings

### Finding 1 — VS Code Profiles: the canonical "preset over composable concepts" prior art

VS Code **Profiles** (shipped Feb 2023, v1.76 — "one of the all-time most requested features") is the cleanest industry instance of exactly the #564 reframe. A profile is a **named bundle** of settings + extensions + UI layout (which views/actions are visible, keybindings) — i.e. *preferences + which surfaces light up*, the precise pairing #564 names. Properties that map 1:1 onto the reframe:

- **Preset over composables** — a profile doesn't *define* settings/extensions; it *selects and bundles* existing ones. Matches "a front-facing label over broader composable concepts."
- **Clone-to-derive** — you create a profile from an existing one and override (the same guardrail #166·Fork 1 ratified for custom personas).
- **Temporary profiles** — a session-scoped preset (the operator *switches into* a mode for a task and out again) — the agile-role multiplexing shape.
- **Shareable** — exported as a file or GitHub gist (the "shareable/team-templated" plane #166·Fork 2 put on the paid side).

Takeaway: the "persona = preset" framing is **not a coined term** — it is the established profile/preset pattern. It validates naming the primitive, and its *separation* (a profile bundles, it does not own, the underlying settings) supports keeping persona a thin lens over independently-owned concepts rather than a fat unified schema.

### Finding 2 — CrewAI agent personas: the agile-role lens is real and already named in industry

CrewAI (and the broader multi-agent field — AutoGen, LangGraph) models each agent as a **"configured LLM persona"** with `role` + `goal` + `backstory`. The framework "treats agents as characters with identities" — roles like *Researcher / Writer / Manager* are not labels but behavioral presets that shape how the agent approaches a task. This is precisely #563's "one operator multiplexing PO/BA/dev/QA via agents":

- A CrewAI `role`/`goal`/`backstory` triple **is** a persona-preset for an agent — the agile-role lens has direct, mainstream prior art.
- It confirms the kinship #564 hypothesizes is *real* (industry models agile-style roles as personas) — **but** CrewAI personas are *prompt-shaping presets*, not a shared schema with governance charters. The kinship is at the **pattern** level (named role-presets), not a merged data model.

Takeaway: name the role-switching primitive in #563's methodology (Recommendation 3) — it has prior art and makes agent role-handoff legible. But there is no industry precedent for *fusing* an agent-role persona and a governance-charter persona into one schema; they are kindred patterns with separate homes (supports Recommendation 1).

### Finding 3 — Persona vs RBAC: PBAC exists, but persona stays a *lens* mapped onto access, never access itself

The access-control literature distinguishes **RBAC** (static job roles → permissions) from **Persona-Based Access Control (PBAC)** (context-aware authorization keyed off a user's *persona*). Crucially, even where personas touch access (TrustBuilder), **the persona is mapped *onto* permission-roles via an `entitlements` attribute** — the persona "feeds RBAC when needed"; it does not *become* RBAC. The canonical example is a *lens switch*: an IT worker uses the `staff` persona for office work and **switches to the `operator` persona** to manage platform settings.

This is decisive for #564·Fork 2 (the re-opened #166 RACI-vs-RBAC line):

- The persona-as-lens framing is exactly the switchable-mode notion #564 describes. ✓
- Even the access-bearing variant (PBAC) keeps persona and authorization **separate**, joined by an explicit mapping — never fused. So "does a persona ever gate access?" resolves to: *only via a separate mapping it references*, which preserves #166's RACI-not-RBAC line and leaves authorization owned by [#178](../backlog/178-access-control-authorization-gate.md). Folding permissions *into* the persona model would be the category error #166 already named.

### Finding 4 — the on-disk schema is a governance charter, not a generic preset (the unification cost)

The implemented `Profile` (`plateau-app/src/profiles/schema.ts:101`) carries `mission`, `signals[]`, `reviewAreas[]` (each pinned to a `platformArea`, `schema.ts:22`), `artifactsOwned[]`, `escalation`, and `gates` with a four-type `GateType` (`schema.ts:48`, post-#566). It has **no** `preferences` or `surfaces`/`toggleMap` field — it is a *governance* charter, not the generic "preferences + surfaces" preset #564 abstracts. The dev-browser "feature toggle map" lens (#141:90) describes surfaces-lit-up but **is not yet built** (it's in #141's staged successor work).

So "unify into one schema" is not free: it would mean either widening `Profile` with preset/preferences fields it doesn't have, or building a new shared primitive and re-expressing the governance charter as a projection of it — a sizeable refactor of resolved, shipping code, against a second lens (agile-role) that is a *methodology concept with no runtime at all*. Per bias-toward-separation, the burden of proof is on combining, and that burden isn't met: name the pattern, keep the homes separate (Recommendation 1).

## Files Created/Modified

| File | Action |
|---|---|
| `reports/2026-06-14-persona-preset-primitive.md` | Created (this report) |
| `src/_data/researchTopics.json` | Added `persona-preset-primitive` entry |
| `src/_includes/research-descriptions/persona-preset-primitive.njk` | Created (research write-up) |
| `backlog/564-personas-as-a-first-class-agile-concept.md` | Rewritten to prepared-fork shape; `preparedDate` set |

## Sources

- VS Code Profiles — [Profiles in Visual Studio Code](https://code.visualstudio.com/docs/configure/profiles); [vscode-docs/profiles.md](https://github.com/microsoft/vscode-docs/blob/main/docs/configure/profiles.md); [Visual Studio Magazine — "one of the all-time most requested features"](https://visualstudiomagazine.com/articles/2023/03/09/vs-code-profiles.aspx)
- CrewAI role-based agent personas — [CrewAI Agents docs](https://docs.crewai.com/en/concepts/agents); [DigitalOcean — role-based agent orchestration](https://www.digitalocean.com/community/tutorials/crewai-crash-course-role-based-agent-orchestration); [Vadim's blog — CrewAI unique features (backstory as persistent persona)](https://vadim.blog/crewai-unique-features)
- Persona vs RBAC / PBAC — [Knostic — Role-Based vs Persona-Based access controls](https://www.knostic.ai/blog/role-vs-persona-based-access-controls); [TrustBuilder — working with personas](https://docs.trustbuilder.com/product/defining-personas)
- Prior governance-lens survey — `reports/2026-06-11-governance-persona-charter-schema.md` (RACI/RBAC, gate types, SaaS custom roles)
