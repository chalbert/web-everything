---
type: decision
workItem: story
size: 5
status: open
parent: "746"
dateOpened: "2026-06-16"
relatedProject: webtheme
crossRef: { url: /backlog/364-unified-design-token-theming-system/, label: "Resolved — webtheme tokens (#364)" }
tags: [webtheme, webdocs, block-explorer, design-system, design-tokens, intents, theming, decision]
---

# Decision — A design system = theme + intents bundle: the manifest shape + a `/design-systems/` catalog surface

The Block Explorer (#746) wants a gallery of popular-system presets — Material-like, Fluent-like, Carbon-like — that a viewer switches between live to watch the same block adapt. But a design system isn't *just* a theme: it bundles a token set with intent defaults and, optionally, trait defaults. This decides how WE represents that named bundle and where it's documented — the keystone the live switcher (#749) loads and the theme creator (#751) emits. Builds on the resolved token model (#364, `webtheme`). Needs a prior-art pass first — `○ needs prep`, not ready to ratify.

## The axis

#364 already settled the *pieces*: `webtheme` owns primitive + component **tokens** (DTCG-authored, compiled to native CSS), and the **intents** (`density`, `surface`, `typography`, `motion`, theme-color) own the semantic tier. What's undecided is the **named composition** that binds a token set + a set of intent defaults (+ trait defaults) into one switchable, shareable, documentable unit — i.e. "a design system." This decomposes into three candidate forks below. Each carries a **bold** candidate default to be confirmed after a prior-art pass (MD3 / Fluent / Carbon / Radix theming bundles; DTCG `$themes`; Style Dictionary).

## Fork 1 — What *is* a design-system bundle, structurally?

**Crux:** is it a first-class new entity, or a config flavor?

- **A. A named *config flavor* (a manifest) that `extends` the platform default** — `{ extends, themeTokens, intentDefaults, traitDefaults }`. Switching design systems = swapping which manifest the explorer loads; a custom theme is just an author-written manifest. Reuses the config-extends-platform-default machinery (no new entity kind). **← candidate default.**
- **B. A new first-class catalog entity** (`designSystems.json` + descriptions), peer to intents/blocks/protocols, with its own schema and lifecycle.
- **C. Pure DTCG `$themes`/theme-set** — lean on the token format's own multi-theme construct, no WE-level bundle. *Likely too narrow* — DTCG `$themes` carries token overrides only, not intent/trait defaults.

*Recommended (to confirm): A* — a manifest/flavor is the lightest home that already composes with `extends`, and it makes "create your own design system" identical to "write a manifest." B may still be needed for the *catalog rendering* (see Fork 3) even if the bundle itself is a flavor.

## Fork 2 — Does the bundle carry intent + trait defaults, or tokens only?

**Crux:** the user's framing — "maybe a design system needs to be theme + intents." Material isn't only its palette; it's also its density, motion, elevation, and interaction defaults (which map to WE intents + traits).

- **A. Tokens + intent defaults + trait defaults** (the full bundle). A preset can set `density: comfortable`, `motion: expressive`, and activate signature traits — so switching to "Material" actually changes behaviour, not just colour. **← candidate default.**
- **B. Tokens + intent defaults only** (no trait activation in the bundle).
- **C. Tokens only** (collapses to Fork 1-C).

*Recommended (to confirm): A* — most-flexible: a bundle that *can* set intent + trait defaults (all optional) subsumes B and C; a brand that only wants colours simply omits the rest.

## Fork 3 — Where are design systems documented / discovered?

**Crux:** the user asked "how to document and bundle both together?" Catalogs auto-render from their registry (the `/protocols/`, `/intents/` precedent).

- **A. A new `/design-systems/` catalog surface** — page + nav + authoring note + validator, auto-rendered from the bundle registry; each entry links to the tokens it uses and the intent/trait defaults it sets. **← candidate default.**
- **B. Fold into the existing `/research/design-token-theming-system/` or webtheme project page** — no new surface.

*Recommended (to confirm): A* — a switchable preset gallery needs a browsable home, and the catalog-auto-render machinery already exists; new discovery surface = page + nav + authoring note + validator (per the catalog-auto-render rule).

---

## Context

- **Builds on #364** (`webtheme`): this decision does *not* re-open the token model or the intent-owns-semantic-tier ruling — it adds the *named composition* layer above them.
- **Consumed by:** #749 (live switcher loads a manifest), #751 (theme creator emits one), #754 (permalink encodes which manifest + overrides).
- **Prep TODO:** survey how MD3 / Fluent / Carbon / Radix package a switchable "theme" (tokens vs behaviour), and whether DTCG `$themes` covers any of it; publish a `/research/` topic; then confirm the bold defaults or revise. Until then this is `○ needs prep`, not ready to ratify.
