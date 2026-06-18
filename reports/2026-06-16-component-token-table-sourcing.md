# Per-component token-table data sourcing for the Web Docs /blocks/ panels

**Decision prep for [#802](../backlog/802-per-component-token-table-data-sourcing-for-the-web-docs-blo.md)** —
one of the three panel-data decisions carved out of
[#727](../backlog/727-web-docs-blocks-uniform-live-example-slot-on-every-per-compo.md)
(sibling to [#801](../backlog/801-per-component-api-data-sourcing-for-the-web-docs-props-table.md)
props-table and [#803](../backlog/803-per-component-a11y-panel-content-data-sourcing-for-the-web-d.md)
a11y panel), under the Web Docs feature-pipeline epic
[#623](../backlog/623-web-docs-feature-pipeline-inventory-workbench-tools-derive-i.md).
Published as the `/research/` topic `component-token-table-sourcing`.

## The question #727 left open

A per-component page (`/blocks/{id}/`) should be able to show a **token table** — the design tokens a
component exposes/overrides. #727's split traced the build premise false and carved this to its own
decision: **where does the per-component token data come from, and what does the table show?**

Three concerns named in the item body:

1. **Data wiring** — `webtheme/` is not exposed to 11ty; there is no `src/_data` token feed today.
2. **block.id → component-token-key mapping** — the component token tier is keyed `button`/`card`, the
   blocks are keyed `action-button`/`data-table`/… — they do not match.
3. **Table scope** — show only the component override, or also the primitive scale it aliases into.

This is **not** greenfield standard authoring — the token model (#403/#404) and the CEM protocol
(#653/#626 Fork 1) both shipped. The survey below grounds the *display/sourcing* choice against prior art
and the existing tree; the rest is concrete-refs work.

## The tree as it actually is (verified 2026-06-16)

- **Component token tier exists but is tiny and archetype-keyed.**
  `we:webtheme/defaultTokens.ts:90-117` carries a component tier — but only two groups, **`button`** and
  **`card`**, each a handful of DTCG nodes that *alias* a primitive
  (`button.radius: { $value: '{we:radius.md}' }`, `card.elevation: { $value: '{elevation.1}' }`). That is
  **2 of 69** blocks, and `button`/`card` are **not block ids** — the closest blocks are `action-button`
  (a Behavior) and there is no `card` block at all. The tier names *generic component archetypes*, not WE
  blocks.

- **A clean flatten/resolve pipeline already projects these to renderable rows.**
  `we:webtheme/tokens.ts:78-140` exposes `flattenTokens()` → `FlatToken { path, type, value, description }`
  and `resolveTokens()` → `ResolvedToken { …, aliasOf, resolved }`. So for `button.radius` the pipeline
  already yields `path=['button','radius']`, `aliasOf='we:radius.md'`, `resolved='0.5rem'` — exactly the
  three columns a token table wants (name · alias · resolved literal). `we:compile.ts:44-48` emits the same
  as CSS: `--button-radius: var(--radius-md)` (the #403 example).

- **CEM already has a first-class per-component CSS-custom-property slot — and it is empty.**
  The Custom Elements Manifest schema (2.1.0) carries a **`cssProperties`** array per declaration
  (alongside `attributes`/`members`/`events`/`slots`/`cssParts`). WE already emits CEM
  (`we:custom-elements.json`, generated from `fui:blocks.json` by `we:scripts/gen-cem.mjs`, #653). The props-table
  block's own write-up says it "projects its members/attributes/events/slots/**cssProperties** into table
  rows" (`we:block-descriptions/props-table.njk:17`). **But `we:gen-cem.mjs` emits no `cssProperties` today**
  (`we:scripts/gen-cem.mjs:71-82` maps only events + exports + `x-webeverything`), and **0** blocks carry
  token/css-property data. So the renderer slot exists and is wired into the same manifest the props table
  consumes — the data path is simply unpopulated.

- **The mapping precedent is the `fuiDemo` field (#727).** #727 added an *optional* `fuiDemo: {file,
  title, height}` field to a block's `fui:blocks.json` entry to point at its FUI-hosted demo
  (`we:src/block-pages.njk` reads it). The consumer-declares-its-source pattern is the in-tree precedent for
  associating a block with a sibling data source.

## Prior art — how component catalogs source & display per-component tokens

Surveyed the `we:references.json` benchmark systems + the relevant specs (design-first step 1):

- **Material Design 3 — three-tier ref/sys/comp tokens, component tokens shown as an alias chain.**
  M3 defines *reference* (primitive) → *system* (semantic) → *component* tokens; a component token like
  `md.comp.filled-button.container.color` **aliases** a system token (`md.sys.color.primary`) which aliases
  a ref token. The component pages show the component token *and* the role it points at — the alias is the
  documentation, not noise. (m3.material.io/foundations/design-tokens.) Directly validates **Fork 3's**
  show-the-alias default and **WE's** component-aliases-a-primitive model.

- **Adobe Spectrum — component-specific tokens that alias alias/global tokens.** Spectrum's token site
  documents per-component tokens (e.g. `button` tokens) that reference global + alias tiers; the table
  shows the reference. (spectrum.adobe.com/page/design-tokens.) Same ref-chain display.

- **Custom Elements Manifest `cssProperties` — the de-facto multi-vendor slot for exactly this.** The CEM
  spec models a component's CSS custom properties as `{ name, default?, description? }` per declaration —
  consumed by api-viewer, Storybook autodocs, VS Code custom-data, JetBrains web-types. This is the *same
  manifest* WE already emits and the props-table already consumes; it is the canonical home for
  per-component token rows. Strongly steers **Fork 1** toward a CEM projection over a parallel 11ty feed —
  "one manifest, many consumers," the principle #626 Fork 1 already ratified for the props table.

- **Storybook design-token addons key off an explicit marker, never dir/name convention.**
  `storybook-design-token` parses CSS custom properties / DTCG and groups them by an explicit *presenter*
  annotation in comments; it never infers a component↔token mapping by name. **Style Dictionary** likewise
  models *references* (aliases) as first-class and can output either the reference or the resolved value —
  the show-alias-vs-resolved choice is an explicit, supported axis, not a quirk. Both validate **Fork 2's**
  explicit-marker default (the broken alternative is name-convention, which WE's `button`≠`action-button`
  mismatch already demonstrates).

**Convergent finding:** every mature system (a) sources component tokens from an explicit per-component
declaration, not a dir/name convention; (b) treats the token's **alias/reference** as the primary thing the
table shows, with the resolved literal alongside; and (c) where a machine-readable manifest exists (CEM),
the CSS-custom-property rows live *in that one manifest*, not a parallel metadata file. WE already has all
three substrates (the token resolve pipeline, the `fuiDemo`-style field pattern, the CEM emit) — the
decision is to wire them, not to invent.

## Per-fork classification (the 7-question pass)

- **Which layer?** Build-time devtools/docs surface. The *invariant* (a per-component token table is a
  projection of an existing source of truth, never a second hand-kept metadata shape) is **WE-standard**
  owned (mirrors #626 Fork 1). The *gen code* and the `cssProperties` emit are an **FUI/build**
  instantiation — but here it lives in WE's own `we:scripts/gen-cem.mjs` since the CEM is WE-emitted.
- **Protocol or intent dimension?** Neither new. The token table rides the **existing DTCG↔CSS protocol**
  (#403) and the **existing CEM protocol** (#653); no new protocol/intent is coined.
- **Expose the whole axis?** Fork 3 (scope) is a display axis — expose the alias *and* resolved, the most
  informative superset, rather than picking one.
- **Fixed mechanic or dimension?** Sourcing (Fork 1) is a fixed mechanic (one projection path); mapping
  (Fork 2) is a per-block optional field (opt-in dimension); scope (Fork 3) is a fixed display shape.
- **DI-injectable?** No runtime DI — author/build-time projection consumed once by the docs build.
- **Most-permissive default?** Fork 2's field is optional (a block without it renders no token panel —
  same graceful-absence rule as #727's `fuiDemo`).
- **Seam between intents?** None; this is a docs projection, not an intent boundary.

Standing bias honoured (separate & decouple): the mapping lives on the **consumer** (`fui:blocks.json`),
keeping `webtheme/` pure and docs-agnostic.

## Recommendations (to ratify in #802)

1. **Fork 1 — source the table from CEM `cssProperties`, projected by `we:gen-cem.mjs`** (not a parallel
   `src/_data` token feed). The component token tier flows into each block's CEM declaration as
   `cssProperties` rows; the existing props-table/token renderer consumes the one manifest. Re-opens
   nothing — it *applies* #626 Fork 1's "one manifest, many consumers" to tokens.
2. **Fork 2 — explicit optional `componentTokens` field on the `fui:blocks.json` entry**, naming the
   `defaultTokens` component group(s) a block draws from (e.g. `"componentTokens": "button"`). Mirrors the
   `fuiDemo` precedent; keeps `webtheme/` unaware of `block.id`. Name-convention is the *broken* branch
   (`button`≠`action-button`).
3. **Fork 3 — show override · alias · resolved literal** (three columns), the M3/Spectrum-aligned superset;
   the data is already in `ResolvedToken.aliasOf`/`.resolved`.

## Red-team notes for the deciding agent

- **Fork 1's** near-forced default rests on #626 Fork 1 being load-bearing — confirm that ruling still
  governs the props table before leaning on it; the parallel-`src/_data`-JSON branch is *coherent* (11ty
  reads JSON/JS data fine) and only excluded by the one-manifest principle, not by being non-functional.
- **Coverage is sparse (2/69) and archetype-keyed.** A skeptic could argue the panel isn't worth wiring
  until more blocks carry component tokens — but that is **prioritization** (when to build), not the
  sourcing **decision** (how it's sourced when built). Keep them separate; the build slice is independently
  prioritised after ratification.
