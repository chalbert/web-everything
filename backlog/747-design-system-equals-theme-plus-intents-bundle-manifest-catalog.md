---
type: decision
workItem: story
size: 5
status: resolved
parent: "746"
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: none
relatedProject: webtheme
relatedReport: reports/2026-06-16-design-system-bundle-prior-art.md
preparedDate: "2026-06-16"
crossRef: { url: /backlog/364-unified-design-token-theming-system/, label: "Resolved — webtheme tokens (#364)" }
tags: [webtheme, webdocs, block-explorer, design-system, design-tokens, intents, theming, decision]
---

# Decision — A design system = theme + intents bundle: the manifest shape + a `/design-systems/` catalog surface

**Grounding (✓ ready to ratify):** no design existed yet for the *named composition* above #364's pieces. Surveyed the leading systems (Carbon, MD3, Fluent v9, Radix Themes) + the token-format standards (DTCG, Style Dictionary) and published `/research/design-system-bundle-composition/` (report: `we:reports/2026-06-16-design-system-bundle-prior-art.md`). The survey **reshaped the forks**: it coupled the original Fork 1↔Fork 2 (content determines entity, so order them) and surfaced a **genuinely new Fork 4** — the *scope* of trait defaults — where all the novelty/risk turns out to live. **Four forks** below, each with a **bold** recommended default.

## The axis

#364 settled the *pieces*: `webtheme` owns primitive + component **tokens** ([we:webtheme/tokens.ts:1-22](../webtheme/tokens.ts) — DTCG 2025.10 model + `extends` deep-merge + alias resolution; [we:webtheme/defaultTokens.ts:8-12](../webtheme/defaultTokens.ts) — the platform default; [we:webtheme/compile.ts:2-8](../webtheme/compile.ts) — DTCG→native CSS), and the **intents** own the semantic tier — `we:tokens.ts:10-13` states it outright: *"the existing intents (surface/density/typography/motion/theme-color) ARE the semantic tier; a token never re-coins a role name."* Registered intents: [we:intents.json](../src/_data/intents.json) `motion` (:3), `density` (:20), `typography` (:1019), `surface` (:1056).

What's undecided is the **named composition** binding a token set + intent defaults (+ trait defaults) into one switchable, shareable, documentable unit. The concern decomposes into four orthogonal axes, each pinned to the real tree:

- **Content** — what fields the unit carries (tokens? intent defaults? trait defaults?). The prior art's load-bearing finding: *content determines entity*, so this is decided first (Fork 2).
- **Entity shape** — config flavor (reuses the `extends`-over-platform-default machinery in [we:plugs/core/CustomRegistry.ts:7,22,26,45](../plugs/core/CustomRegistry.ts) + the `extends` deep-merge in `we:webtheme/tokens.ts`) vs a new first-class catalog entity (Fork 1).
- **Trait-default scope** — *presentational* traits only (radius/density/motion-feel — the lone Radix precedent) vs interaction-behavior activation (zero prior art); the traits themselves: [we:traits.json:41-88](../src/_data/traits.json) (delivery / inert dead-zone / visibility gate) (Fork 4).
- **Discovery surface** — a new `/design-systems/` catalog auto-rendered from a registry, per the [we:src/protocols.njk:50-74](../src/protocols.njk) / [we:src/intents.njk:41-51](../src/intents.njk) precedent (nav in [we:base.njk:41,44](../src/_layouts/base.njk)) vs folding into an existing page (Fork 3).

### Per-fork classification (the 7-question pass)

Run once for the bundle, since the forks share an object: **(1) layer** — a WE *standard* artifact (a manifest schema + a catalog surface), authored in `webeverything`; the tokens it references are `webtheme` (constellation: standard→WE). **(2) protocol or intent dimension?** — *neither*: DTCG is the protocol (already adopted, #403); the intents already own the semantic tier. The bundle is a *composition/config* over both, not a new protocol or intent. **(3) expose the whole axis?** — yes: "which design system" is an author-customizable, open-ended dimension (write your own manifest), not a fixed enum — mirrors Intents-Open-Design. **(4) fixed mechanic or dimension?** — a dimension (switchable, extensible). **(5) DI-injectable?** — it is plain config that `extends` the platform default and is *consulted at runtime* by the switcher (#749) — runtime config, not a global mutable registry; not devtools-only. **(6) most-permissive default?** — all non-token fields optional (a colors-only brand omits them) → Fork 2-A. **(7) seam between intents?** — the bundle sits *above* intents (sets their defaults), never merges or re-coins them; honours the separation bias — `we:tokens.ts` already enforces "a token never re-coins a role name."

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|------|---------------------|------------------|------------|
| **2 — Content** | tokens + **optional** intent defaults + **optional** trait defaults (full but all-optional bundle) | tokens + intent defaults only | High — most-flexible subsumes the narrower options; matches WE's most-permissive-default rule |
| **1 — Entity shape** | a named **config flavor (manifest) that `extends` the platform default**, *plus* a thin catalog registry for rendering | a new first-class catalog entity | High — content (Fork 2) lands value+config, which the prior art maps to *flavor*; reuses `extends` machinery |
| **4 — Trait-default scope** | **presentational traits only** (radius/density/motion-feel); behavioral-trait activation stays per-usage | allow behavioral-trait activation in the bundle | Med — the genuinely novel call; Radix is the only precedent and it stops at visual |
| **3 — Discovery surface** | a new **`/design-systems/`** catalog (page + registry + nav + authoring note + validator) | fold into the webtheme project page | High — a switchable gallery needs a browsable home; catalog-auto-render machinery already exists |

> The forks are numbered for stable reference; the *decision order* is 2 → 1 → 4 → 3 (content first, since content determines entity).

## Ruling — ratified 2026-06-16

**All four forks resolved to their recommended default (A).** A WE design system is a **named config-flavor manifest** `{ extends, themeTokens (DTCG ref), intentDefaults?, traitDefaults? }` that `extends` the platform default (Fork 1-A); it carries **tokens + optional intent defaults + optional presentational trait defaults**, every non-token field optional (Fork 2-A); trait defaults are **presentational only** — behavioral-trait *activation* never enters the bundle (Fork 4-A); and design systems are discovered via a new **`/design-systems/` catalog** auto-rendered from a thin `we:designSystems.json` registry (Fork 3-A).

**Two clarifications captured during ratification:**
1. **A ≠ identical behavior (Fork 4).** Behavioral *character* rides in the bundled **intent defaults** (motion physics, density, surface interaction, focus model); only trait *activation* (sortable/dead-zone/delivery) stays per-usage. Re-theming re-skins and re-tunes feel but never un-wires a component's function.
2. **The bundle reaches traits only *transitively*, never directly.** A design system sets intent defaults; those intents may drive trait build-time config through a **resolver** (intent profile → which traits bundle + delivery) — keeping intents UX-only and traits technical. The bundle never names a trait. That resolver is its own mechanic → **#776**.

**Spin-offs filed:** **#775** (design-system creator/assembler — simple FUI-native + full Plateau, open-core), **#776** (intent-profile→trait build-time resolver). Successor builds (now agent-ready against this shape): **#749** live switcher, **#751** Plateau-embed creator, **#754** permalink/export.

## Fork 2 — What does the bundle carry? (decide first)

**Crux** ([we:webtheme/tokens.ts:10-13](../webtheme/tokens.ts)): Material isn't only its palette — it's also density, motion, elevation, interaction. The prior-art finding is that the *content* tier is load-bearing: it determines whether this is a config flavor or a first-class entity (Fork 1). So decide it first.

- **A. Tokens + *optional* intent defaults + *optional* trait defaults** — the full bundle, every non-token field optional. A preset *may* set `density: comfortable`, `motion: expressive`, and presentational trait defaults (scope in Fork 4); a colors-only brand omits them. Subsumes B and C. **← default.**
- **B. Tokens + intent defaults only** — no trait defaults in the bundle at all.
- **C. Tokens only** — collapses to "a theme is a token set," the Carbon/DTCG position.

**Default: A.** Most-permissive-default rule: an all-optional bundle subsumes B and C at zero cost to a brand that wants less. The prior art shows real systems span the whole (a)→(c) range, so the bundle's *schema* must reach the widest of them; what a given preset *uses* is the author's opt-in. *Rejected:* **B/C** as the schema ceiling — they'd force a breaking schema change the first time a preset wants a signature behavior (which Fork 4 shows is legitimate within bounds).

**Example** — one schema, two presets at opposite ends of the (a)→(c) range:

```jsonc
// presets/material-like.designsystem.json — uses every optional field
{
  "extends": "@webtheme/default",
  "themeTokens": "./material.tokens.json",                       // DTCG ref — the only required field
  "intentDefaults": { "density": "comfortable", "motion": "natural", "surface": "lift" },  // optional
  "traitDefaults":  { "radius": "lg" }                           // optional — presentational only (Fork 4)
}

// presets/acme-brand.designsystem.json — a colors-only brand, SAME schema, optional fields omitted
{ "extends": "@webtheme/default", "themeTokens": "./acme.tokens.json" }
```

Intent values are real: `density` ∈ comfortable/compact/wafer, `motion.physics` ∈ natural/immediate/reduced, `surface.interaction` ∈ static/lift/scale ([we:intents.json](../src/_data/intents.json)). Picking **B/C** would reject `acme-brand` *and* `material-like` from sharing a schema — `material-like` could not exist without a breaking change.

## Fork 1 — Config flavor, or first-class entity?

**Crux:** with content = value + optional config (Fork 2-A), the prior art maps the unit cleanly to *config* (Carbon's theme = a Sass map / `--cds-*` swap; Style Dictionary themes = build configs — all flavors, no identity beyond their values), not to a first-class interchange entity. The `extends`-over-platform-default machinery already exists: generic [we:plugs/core/CustomRegistry.ts:7,22,26,45](../plugs/core/CustomRegistry.ts), realized as the token `extends` deep-merge in [we:webtheme/tokens.ts:18-21](../webtheme/tokens.ts).

- **A. A named *config flavor* (manifest) that `extends` the platform default** — `{ extends, themeTokens (a DTCG ref, not embedded), intentDefaults, traitDefaults }`. Switching = swapping which manifest the explorer loads; "create your own design system" = "write a manifest." *Plus* a thin catalog registry (`we:designSystems.json`) listing the named presets — needed purely so the `/design-systems/` page (Fork 3) has something to iterate. **← default.**
- **B. A new first-class catalog entity** with its own schema + lifecycle, peer to intents/blocks/protocols.
- **C. Pure DTCG `$themes`/theme-set** — lean on the token format's own multi-theme construct, no WE bundle.

**Default: A** (manifest flavor + thin rendering registry). It reuses `extends`, makes custom design systems identical to writing a manifest, and references DTCG tokens rather than embedding them (keeping tokens portable — the survey's "tokens in the standard format, defaults in a WE sidecar" finding). *Rejected:* **B** — a full first-class entity with its own lifecycle is ceremony the content doesn't earn (the registry in A is a rendering index, not a lifecycle-bearing entity). **C** — the official DTCG Format Module has **no `$themes` construct** (it's a Tokens Studio vendor extension), and even Tokens Studio themes carry token overrides only, never intent/trait defaults — structurally can't hold Fork 2-A's content.

**Example** — the manifest *is* the flavor (Fork 2-A's file), and switching reuses the existing deep-merge; the only new artifact is a thin index for the catalog (Fork 3) to iterate — **not** a lifecycle entity:

```jsonc
// src/_data/designSystems.json — Fork 1-A: a rendering index, peer to NOTHING; no schema/lifecycle of its own
[
  { "id": "material-like", "name": "Material-like",
    "manifest": "presets/material-like.designsystem.json",
    "summary": "MD3-flavored — comfortable density, natural motion, lift surfaces." }
]
```

```ts
// Switch = load a manifest, then merge over the platform default with machinery that ALREADY exists:
extendTokens(defaultTokens, load(ds.manifest).themeTokens)   // webtheme/tokens.ts:18-21 + defaultTokens.ts
```

Contrast **B**: that index would instead grow a `$schema`, validation lifecycle, and a peer slot beside `intents`/`blocks`/`protocols` — ceremony the four-field manifest never needs.

## Fork 4 — Scope of trait defaults *(new — surfaced by the survey)*

**Crux:** Fork 2-A lets the bundle carry trait defaults — but *which* traits? The survey's sharpest finding: **Radix is the only system that bundles behavior into a switchable theme, and it stops at *visual* behavior** (`radius` = shape, `scaling` = density, `panelBackground` = surface treatment) — never interaction logic, state machine, or focus order. Bundling *interaction* behavior has **zero prior art**. WE's traits split exactly along this line: presentational vs behavioral-activation knobs ([we:traits.json:41-88](../src/_data/traits.json) — delivery / inert dead-zone / visibility gate).

- **A. Presentational trait defaults only** — a bundle may set visual/feel traits (radius, density-feel, motion-feel); behavioral-trait *activation* (inert dead-zone, visibility-gate, delivery) stays a per-usage decision, never bundled. **← default.**
- **B. Any trait, including behavioral activation** — a preset can switch interaction behavior too.

> **Does A make every design system behave identically? No** — behavioral *character* is carried by the **intent defaults** the bundle already sets (Fork 2-A): `motion.physics` (natural/immediate/reduced), `density` (touch-target size), `surface.interaction` (static/lift/scale), `interaction.modality`, `focus-delegation`. Material-like (comfortable + natural + lift) genuinely behaves and feels different from Carbon-like (compact + immediate + static), and that switches with the theme. What A keeps out is only trait **activation** — *is this list sortable, does this region go dormant when inert, lazy-vs-eager load* — which is a per-element functional/correctness/perf decision tied to what that element does, **not** a brand property. The desired invariant: swapping Material→Carbon re-skins and re-tunes feel, but never silently un-wires a component's function. (Note: every trait that exists today is activation-type, so in practice A's bundled behavioral variation is *entirely* via intent defaults; the "presentational traits" slot is a forward-compatible allowance for future visual-only traits.)

**Default: A.** This is the fork-existence test in action: B is a *flawed* end-state, not a legitimate alternative — switching interaction behavior with a theme has no precedent, conflicts with the leaders' clean separation (Carbon/MD3/Fluent all keep behavior off the theme layer), and a viewer swapping "Material → Carbon" expects a re-skin, not a behavior change. Bounding to presentational traits is also the most-permissive value that still has precedent. *Rejected:* **B** — surprising, unprecedented, and conflates the switchable-appearance axis with the interaction-design axis the component/trait layer already owns per-usage.

**Example** — the line runs through `traitDefaults`: visual/feel in, behavioral activation out:

```jsonc
// ✓ A — presentational/feel traits are bundle-settable
"traitDefaults": { "radius": "lg", "motion-feel": "expressive" }

// ✗ B (rejected) — behavioral-trait ACTIVATION never enters the bundle; it stays a per-usage attribute:
//   inert dead-zone re-enable   <ul sortable sortable-active>            (traits.json:65-72)
//   visibility gate             <section reveal reveal-when="visible">   (traits.json:74-82)
//   delivery preload            <ul sortable sortable-delivery="eager">  (traits.json:41-52)
```

So "Material-like → Carbon-like" re-skins (radius, feel) but never silently flips a list from sorting-active to dormant — that activation choice remains where the page author placed it.

## Fork 3 — Where are design systems documented / discovered?

**Crux:** catalogs auto-render from a registry — the [we:src/protocols.njk:50-74](../src/protocols.njk) (over [we:protocols.json](../src/_data/protocols.json)) and [we:src/intents.njk:41-51](../src/intents.njk) precedent, nav wired in [we:base.njk:41,44](../src/_layouts/base.njk). A switchable preset gallery needs a browsable home, and Fork 1-A already produces the `we:designSystems.json` registry it would render from.

- **A. A new `/design-systems/` catalog surface** — page + nav + authoring note + validator, auto-rendered from `we:designSystems.json`; each entry links the DTCG tokens it references and the intent/trait defaults it sets. **← default.**
- **B. Fold into the existing webtheme project page or `/research/design-token-theming-system/`** — no new surface.

**Default: A.** Per the catalog-auto-render rule a new discovery surface = page + `_data` registry + nav + authoring note + validator, and the machinery already exists. *Rejected:* **B** — a gallery the explorer switches between is a first-class discovery surface, not a sub-section of a token research page; folding it in buries it and breaks the auto-render precedent.

**Example** — the page iterates the Fork 1-A registry exactly like the protocols/intents catalogs already do:

```njk
{# src/design-systems.njk — auto-rendered, mirroring src/protocols.njk:50-74 over designSystems.json #}
{% for ds in designSystems %}
  <a href="/design-systems/{{ ds.id }}/">{{ ds.name }} — {{ ds.summary }}</a>
{% endfor %}
```

The full checklist (catalog-auto-render rule): the page above + the `we:designSystems.json` registry (Fork 1-A) + a nav entry beside Protocols/Intents ([we:base.njk:41,44](../src/_layouts/base.njk)) + an authoring note + a `check:standards` validator. **B** would instead append a `<section>` to the webtheme project page — no per-preset URL, no nav slot, invisible to the auto-render gate.

---

## Context

- **Builds on #364** (`webtheme`): does *not* re-open the token model or the intent-owns-semantic-tier ruling — it adds the *named composition* layer above them.
- **Consumed by:** #749 (live switcher loads a manifest), #751 (theme creator emits one), #754 (permalink encodes which manifest + overrides).
- **Prepared 2026-06-16:** prior-art survey + classification done; `/research/design-system-bundle-composition/` published (report `we:reports/2026-06-16-design-system-bundle-prior-art.md`). All four forks at DoR with bold defaults — `✓ ready to ratify`. Making the call is `/next decision`'s job.
