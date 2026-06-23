---
kind: decision
parent: "142"
status: resolved
locus: plateau-app
dateOpened: "2026-06-23"
dateStarted: "2026-06-23"
dateResolved: "2026-06-23"
codifiedIn: one-off
graduatedTo: none
preparedDate: "2026-06-23"
relatedReport: reports/2026-06-23-dev-browser-role-scoped-lenses.md
crossRef: { url: /backlog/141-dev-browser-vision/, label: "#141 Profiles — feature toggle map over surfaces" }
tags: [dev-browser, role-lens, persona, plateau, decision]
---

# Role-scoped lenses over one dev browser

## Digest

This is the **lone genuine merit fork** carved from the [#142 AI-DX candidate pool](/backlog/142-ai-generated-dev-experience-feature-candidates/) — its 21 sibling cards are prioritization ("build X, on what trigger"), but #1636 forces a contested **layer/shape either/or** decidable now with no trigger. The same browser shows a designer the visual-edit surface, a rule-owner the rules surface, a translator the i18n surface, a dev state/tests — the question is *what shape that takes*. Grounded in the [dev-browser role-scoped lenses](/research/dev-browser-role-scoped-lenses/) research topic. The recommended default is **(a) lens-as-first-class-primitive** — a thin, load-bearing dimension of the dev-browser surface model that every feature declares against, realized as the already-ruled persona-preset primitive ([#564](/backlog/564-personas-as-a-first-class-agile-concept/)) projected onto the running app. The composability probe **shrinks the fork**: independent per-role panels are the degenerate config of the primitive, not a rival shape.

## Resolution — ratified 2026-06-23

Ratified **Fork 1 = (a) lens-as-first-class-primitive** (Confidence Med-High). The role lens is a thin, load-bearing dimension of the dev-browser surface model: every feature declares which `lenses[]` it appears in and how it is scoped, and the active lens filters/re-orders the feature menu. Independent per-role panels are **rejected** — they are the primitive's degenerate config built implicitly, with no cross-role coherence and recurring RBAC-creep risk. Inherited invariants stand: **RACI-not-RBAC** (authorization owned by [#178](/backlog/178-access-control-authorization-gate/)), **free read-only** ([#1655](/backlog/1655-dev-browser-in-shell-free-paid-line-which-shell-capabilities/)), roster reused as **data** from the #166/#564 persona model. This is the upstream lens-shape ruling the panel-shaped siblings (#1632/#1634/#1638/#1642/#1643) register against — cite #1636 rather than re-open. `graduatedTo: none` (the build of the primitive is a separate story, not yet filed).

## Axis-framing

The axis is the **shape of "role" in the dev-browser surface model**, and it is pinned — not invented — by settled prior art. The decisive fact is that this lens is **not greenfield**: [#564](/backlog/564-personas-as-a-first-class-agile-concept/) (resolved) already named the **persona-preset primitive** ("a named preset over composable concepts: preferences + surfaces-lit-up") and identified the dev-browser "feature toggle map" lens as its **third, not-yet-built projection** — alongside the shipped governance charter ([#166](/backlog/166-governance-persona-roster-charter-schema/)) and the agile-role concept ([#563](/backlog/563-ai-driven-agile-methodology-as-a-shareable-approach/)). The runtime analogue is on disk: `Profile` carries `reviewAreas[]` ([plateau:src/profiles/schema.ts:143](../../plateau-app/src/profiles/schema.ts#L143)), each `ReviewArea` pinned to a `platformArea` ([plateau:src/profiles/schema.ts:49](../../plateau-app/src/profiles/schema.ts#L49)) — the schema doc-comment states a profile is *"a lens over the existing platform, not a parallel world"* ([plateau:src/profiles/schema.ts:10](../../plateau-app/src/profiles/schema.ts#L10)). #141 itself already calls the lens a primitive: the role surfaces are *"a feature toggle map over the introspection surfaces … without separate products"* ([we:backlog/141-dev-browser-vision.md:90](/backlog/141-dev-browser-vision/)) — independent panels would be the *"separate products"* the vision rejects. Two forced invariants are inherited and not re-opened here: a lens is a **decision-rights / preference lens (RACI), never authorization (RBAC)** — access stays owned by the access-control gate [#178](/backlog/178-access-control-authorization-gate/) ([plateau:src/profiles/schema.ts:34](../../plateau-app/src/profiles/schema.ts#L34)); and the lens is **read-only and free** — [#1655](/backlog/1655-dev-browser-in-shell-free-paid-line-which-shell-capabilities/)'s capability map already classifies #1636 *"Free — read-only re-skin of one browser; no persist"* ([we:backlog/1655-dev-browser-in-shell-free-paid-line-which-shell-capabilities.md:79](/backlog/1655-dev-browser-in-shell-free-paid-line-which-shell-capabilities/)). The lens roster is the #166 persona roster, plateau-app-owned and read as data per the #166 Fork-3 shared-data-home ruling.

### Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 · lens shape** | lens-as-first-class-primitive (every feature declares its lenses; panels are its degenerate config) | independent per-role panels *(rejected — re-implements role logic per feature; no cross-role coherence)* | **Med-High** — projection of the already-ruled #564 persona-preset primitive |

## Fork 1 — is "role/lens" a first-class surface-model primitive, or independent per-role panels?

**Fork-existence:** a real either/or for the *same* surface model — either the lens is the load-bearing dimension the whole feature menu is built around, or it is not and the role surfaces are unrelated panels. Both cannot be the default for one model. (The composability probe below shows one branch *subsumes* the other, which shrinks — but does not dissolve — the fork: the residual is only *how thin* the primitive is.)

**Crux:** #141 frames the role surfaces as *"a feature toggle map over the introspection surfaces … without separate products"* ([we:backlog/141-dev-browser-vision.md:90](/backlog/141-dev-browser-vision/)), and #564 already named the underlying **persona-preset primitive** and listed this very lens as its not-yet-built third projection. The governance charter ships the runtime analogue — `reviewAreas[]` ([plateau:src/profiles/schema.ts:143](../../plateau-app/src/profiles/schema.ts#L143)) pinned to `platformArea` ([plateau:src/profiles/schema.ts:49](../../plateau-app/src/profiles/schema.ts#L49)), "a lens over the platform" ([plateau:src/profiles/schema.ts:10](../../plateau-app/src/profiles/schema.ts#L10)). So the question is whether the dev-browser builds that projection as a primitive, or fragments it into panels.

**Composability probe (it shrinks the fork):** *can independent panels be a facade over a lens primitive, or vice versa?* A per-role panel is exactly the degenerate case of a lens — "one lens that scopes the entire feature menu to one role, with no cross-lens declarations." The **primitive subsumes the panels cleanly**; the reverse does not hold (panels cannot subsume the primitive without re-deriving a cross-cutting role dimension — i.e. re-inventing the lens). So the fork shrinks to *"build the primitive; panels are its degenerate preset,"* with the only residual being the primitive's thinness.

- **(a — recommended) Lens-as-first-class-primitive.** A thin, load-bearing dimension of the surface model: every feature (the #1631–#1652 inspectors, the #141 named surfaces) **declares which lenses it appears in and how it is scoped**; the active lens filters/re-orders the feature menu. Realized as the #564 persona-preset projected onto the running app — **a lens === a persona charter's `reviewAreas` filtered onto the introspection surfaces**, the runtime twin of `platformArea` ([plateau:src/profiles/schema.ts:49](../../plateau-app/src/profiles/schema.ts#L49)). **Merit:** high cross-role coherence (one model; a new role re-uses every feature's declaration); high composition (custom/blended lenses — #141's build-your-own profile — fall out for free); correctness (the RACI invariant is enforced once at the primitive); no new lock-in (reuses the #166/#564 persona data).
- **(b) Independent per-role panels.** Designer / rule-owner / translator / dev views as unrelated panels with no shared lens. **Merit:** none over (a) — every downside re-expressed as a merit axis: **no cross-role coherence** (each panel re-implements role logic), **low composition** (a blended view = a bespoke new panel), **correctness drift** (role logic duplicated per feature; each panel can independently re-introduce RBAC-creep, violating the #564 invariant). *Rejected* — it is the primitive's degenerate config built *implicitly*, re-paying the same role dimension incoherently at every feature; it also contradicts #141's explicit *"without separate products."*

**Default: (a) lens-as-first-class-primitive.** Most-permissive + bias-toward-separation both point here: a thin shared dimension keeps each feature's per-role behaviour separable and declarable, where panels couple role logic into each feature's body. Reuse the #166/#564 persona roster (plateau-app-owned, read as data); keep RACI-not-RBAC and free (#1655).

*Rejected:* (b) independent per-role panels — re-implements role logic per feature, no cross-role coherence, contradicts #141's "without separate products," and is merely the primitive's degenerate config built implicitly.

**Skeptic:** "A primitive every feature must register against is a coordination tax and a YAGNI risk — the real first feature is one panel; the abstraction is speculative." Refuted on merit (not cost): the abstraction is **not speculative** — #564 already named it and #141 already specified the toggle-map shape; the probe shows the panel IS the primitive's degenerate config, so shipping the panel *without* the one-field declaration just hides the same dimension and re-pays it incoherently at every later feature. The thin form (one `lenses[]` declaration + a filter) is *less* than the duplicated role logic panels force. The genuine residual the Skeptic surfaces is **thinness** — ship declaration + filter, defer custom/blended-lens authoring to the build; do not gold-plate the primitive.

## Context

- **Lineage:** granular `decision` child of [#142](/backlog/142-ai-generated-dev-experience-feature-candidates/), extending [#141](/backlog/141-dev-browser-vision/)'s Profiles section. It is the **upstream** lens-shape decision for the panel-shaped sibling cards ([#1632](/backlog/1632-live-contract-and-data-inspector-at-provider-context-seams/), [#1634](/backlog/1634-semantic-explain-this-element-inspector/), [#1638](/backlog/1638-in-context-annotation-and-discussion-threads-on-semantic-no/), [#1642](/backlog/1642-intent-and-a11y-conformance-inspector/), [#1643](/backlog/1643-variant-simulator-for-locale-flag-role-viewport-motion/)) — settling the lens shape gives those panels their registration home.
- **Inherited and not re-opened:** the persona-preset primitive itself is ruled (#564 — name the pattern, separate homes); a lens is RACI-not-RBAC with access owned by #178; the lens is free read-only (#1655). This card decides only the **dev-browser shape** of that primitive.
- **Constellation:** plateau-app-owned (`locus: plateau-app`), reusing the #166 persona roster as data (the #166 Fork-3 shared-data-home seam) — no WE standard entity, no Intent; the lens has no conformance/interop story.
