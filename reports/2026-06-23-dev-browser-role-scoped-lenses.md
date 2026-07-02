# Dev-browser role-scoped lenses — prior art + the layer/shape fork (prep for #1636)

**Date:** 2026-06-23 · **Item:** [#1636](/backlog/1636-role-scoped-lenses-over-one-dev-browser/) ·
**Parent epic:** [#142](/backlog/142-ai-generated-dev-experience-feature-candidates/) ·
**Extends:** [#141 dev-browser vision](/backlog/141-dev-browser-vision/)

## Why this is the one preparable card in #142

The #142 epic is a pool of 21 granular `decision` children. Triage found that almost all of them are
**prioritization** — "do we build X, and on what trigger" — which is not a merit fork (a fork rules *best on
merit*; cost/trigger is sequencing). #1636 is the exception: it forces a contested **layer/shape either/or**
that is decidable *now*, with no trigger, and is **architecturally upstream** of the panel-shaped siblings
(#1632 / #1634 / #1638 / #1642 / #1643). Settle the lens shape and those panels inherit their home.

## The fork

> Is **"role / lens" a first-class dimension** baked into the dev-browser's surface model — a load-bearing
> primitive every feature (inspectors, panels, simulators) registers against and is filtered/scoped by — **or**
> are role surfaces just **independent feature panels** with no unifying lens abstraction?

They cannot both be the default for one surface model: either the lens is the primitive the surface is built
around, or it is not and #1636 dissolves into "ship per-role panels."

## Prior art

### In-repo (decisive)

- **The persona-preset primitive is already named and ruled.** [#564](/backlog/564-personas-as-a-first-class-agile-concept/)
  (resolved 2026-06-14) ruled: *"persona = a named preset over composable concepts (preferences +
  surfaces-lit-up)."* It explicitly lists **three projections** of the one primitive: the shipped governance
  charter ([#166](/backlog/166-governance-persona-roster-charter-schema/)), the agile-role concept
  ([#563](/backlog/563-ai-driven-agile-methodology-as-a-shareable-approach/)), and — **not yet built** — the
  **dev-browser "feature toggle map" lens** (#141 Profiles). #1636 is the decision to build that third
  projection. #564's ruling was *bias-toward-separation*: name the shared **pattern**, do **not** force one
  unified runtime schema across the three homes.
- **The governance charter is the runtime analogue.** `plateau:src/profiles/schema.ts` ships `Profile` with
  `reviewAreas[]`, each `ReviewArea` pinned to a `platformArea` (the platform domain it overlays). The schema
  doc-comment states a profile is *"a lens over the existing platform, not a parallel world."* That is exactly
  the dev-browser lens, projected from "platform domains" onto "live introspection surfaces": a lens declares
  which surfaces it cares about, the way a charter declares which `platformArea`s it reviews.
- **#141 already calls the lens a primitive.** The Profiles section (#141) describes the role surfaces as
  *"a feature toggle map over the introspection surfaces, so the same browser reshapes itself per role/task
  without separate products."* The vision's own words are the primitive shape — independent panels would be
  *"separate products,"* which #141 explicitly rejects.
- **The forced invariant: RACI, not RBAC.** Both #166 and #564 ruled a persona/lens is a **decision-rights +
  preference lens (RACI)** — it scopes *what you see*, never *what you may do*. Authorization stays owned by
  the access-control gate ([#178](/backlog/178-access-control-authorization-gate/)). A lens must not be built
  as a permission system.
- **The free/paid line is already drawn.** [#1655](/backlog/1655-dev-browser-in-shell-free-paid-line-which-shell-capabilities/)'s
  capability map classifies #1636 as **Free** — *"read-only re-skin of one browser; no persist."* The lens is
  a read-only funnel capability, which reinforces RACI-not-RBAC and zero server cost.

### Market

- **Figma Dev Mode** — a genuine *mode-as-first-class-dimension*: one canvas, role-parameterized (design vs
  dev), and features behave differently per mode. The strongest precedent for a lens primitive: the mode is
  load-bearing across the whole surface, not a separate app.
- **Chrome DevTools** — **no** role primitive. Independent panels (Elements / Network / Sources / …) with no
  unifying "who are you" dimension. The strongest precedent for the *panels* shape — and a cautionary one:
  there is no cross-panel role coherence because there is no lens.
- **Storybook** — viewmodes (canvas / docs) + addons are a *registry of independent surfaces*; role is not a
  modelled dimension. Panels-shaped.
- **RBAC-driven UI** — gates the UI by *permission*. This is the category error #166/#564 already ruled out:
  it answers "what may you do," not "what do you want to see." Not a model for the lens.

## The two shapes weighed (merit only)

Cost/effort ("another abstraction to maintain", "more to build") is **not** a merit axis and is stripped. The
real axes are **cross-role coherence**, **composition**, **correctness**, and **lock-in**.

| Axis | (a) Lens-as-first-class-primitive | (b) Independent per-role panels |
|---|---|---|
| Cross-role coherence | One model: every feature's per-role behaviour is declared in one place; a new role re-uses every feature's declaration. | None: each panel re-implements its own role logic; no shared notion of "role." |
| Composition | High: a feature appears in N lenses by declaration; custom/blended lenses (the #141 build-your-own profile) fall out for free. | Low: a blended view means a new bespoke panel. |
| Correctness | A feature declares its lenses once → consistent scoping; the #564 invariant (RACI) is enforced at the primitive. | Role logic duplicated per feature → drift; each panel can re-introduce RBAC-creep independently. |
| Lock-in | The lens roster is the #166/#564 persona data, owned by plateau-app, read as data — no new lock. | None added, but no reuse of the existing persona model either. |

## The composability probe — it shrinks the fork

**Can independent panels be a facade over a lens primitive, or vice versa?** A per-role panel is exactly the
degenerate case of a lens: *"one lens that scopes the entire feature menu to one role, with no cross-lens
declarations."* So the **primitive subsumes the panels** cleanly — panels are the primitive's degenerate
config. The reverse does not hold: panels cannot subsume the primitive without re-deriving a cross-cutting
role dimension (i.e. re-inventing the lens). Therefore the fork **shrinks** from a true either/or to:
**build the lens primitive; per-role panels are its degenerate preset.** The residual judgment is only
*how thin* the primitive is (a declaration field + a filter), not *whether* to have one.

## Recommended default

**(a) Lens-as-first-class-primitive** — a thin, load-bearing dimension of the dev-browser surface model that
every feature declares against, realized as the #564 persona-preset projected onto the running app (a lens
=== a persona charter's `reviewAreas` filtered onto the introspection surfaces). Independent per-role panels
are its degenerate config, not a rival. Reuse the #166/#564 persona roster (plateau-app-owned, read as data
per #166 Fork-3); keep it RACI-not-RBAC and free (#1655). **Confidence: Med-High** — the persona-preset
primitive is already ruled and #141 already frames the lens as a toggle-map, so this is a *projection of a
settled primitive*, not a fresh abstraction; the residual is the thinness of the primitive, deferred to build.

**Skeptic:** "A primitive every feature must register against is a coordination tax and a YAGNI risk — the
real first feature is one panel, and the abstraction is speculative." Refuted on merit, not cost: the
abstraction is **not speculative** — #564 already named it and #141 already specified the toggle-map; and the
probe shows the panel IS the primitive's degenerate config, so building the panel *without* the one-field
declaration just hides the same dimension implicitly and re-pays it (incoherently) at every later feature. The
thin form (one `lenses[]` declaration + a filter) costs less than the duplicated role logic the panels shape
forces. The genuine residual the Skeptic surfaces is *thinness*: do not gold-plate the primitive — ship the
declaration + filter, defer custom/blended-lens authoring to the build.

## Relationship to the persona-charter model

The lens **is** the dev-browser projection of the persona-preset primitive (#564). It does **not** introduce a
new persona concept: it reuses the #166 roster as data (per the #166 Fork-3 shared-data-home seam) and obeys
the #564 forced invariant (RACI, never RBAC; access stays #178's). Where the governance charter pins each
`reviewArea` to a `platformArea` (a static platform domain), the dev-browser lens pins each role to the
**live introspection surfaces** it lights up — same shape, runtime target. This is why the recommended default
is a *projection*, not a greenfield abstraction.
