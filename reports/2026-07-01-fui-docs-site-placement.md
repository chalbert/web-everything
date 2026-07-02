# FUI docs-site placement — is the FUI docs-website a product to extract, or a reference-showcase co-located with the library?

**Item:** #2053 (`kind: decision`, prepared 2026-07-01). Parallel to #2006 (WE-standard vs WE-website), but
with a decisive disanalogy: **FUI is the implementation tier and legitimately holds runtime**, so #2006's
zero-impl driver does not transfer. The distinguishing test is *product-vs-render*, not *impl-vs-contract*.

## What the FUI docs-site actually is (grounding, read from the tree)

Frontier UI (GitHub `chalbert/frontierui`) intermingles a docs-site render with the reference-implementation
library, the same *surface* pattern #2053 flags:

- **The render:** `fui:.eleventy.js` (Eleventy, input `fui:src/` → output `fui:_site/`), `fui:src/*.njk`
  pages (index, blocks, plugs, adapters, traits, demos, about), `fui:src/_data/*.js` loaders,
  `fui:src/_layouts/base.njk`, `fui:src/css` / `fui:src/assets`. Built by `npm run build:docs` (`eleventy`);
  served dev at port 6080 (`dev:docs`).
- **What it renders:** its `_data` loaders read the library's *own* catalog — `fui:src/_data/demos.js` scans
  repo-root `fui:demos/*.html`; `fui:src/_data/blocks.json`, `fui:src/_data/plugs.json`,
  `fui:src/_data/traits.json` mirror the block/plug/adapter catalog. `fui:src/index.njk` is a docs-home
  ("A reference implementation of Web Everything protocols", a call-to-action into its blocks index, a link
  out to the WE protocols). It links runnable demos out to the library's own Vite origin (`site.demosUrl`,
  dev port 6002). It is a **dogfood reference-showcase of the library**, not an independent client product.
- **Not the docs-site:** `fui:webdocs/` is a docs *toolchain* (Mintlify/Storybook export adapters +
  coverage/generator), and `fui:vite.config.mts` builds the **demos** bundle (port 6002), not the docs pages.
  Neither is the "website surface" #2053 asks about.

Contrast with WE's website (#2006): that carried genuine product client-features (backlog board, burndown,
graph, the #184 marketing landing) **and** sat in a zero-impl repo where any artifact-producing render is a
placement violation. Neither condition holds for FUI: no independent product features, and FUI is *allowed*
to hold runtime.

## The two constellation facts that flip the default vs #2006

1. **FUI legitimately holds runtime.** Constellation rule 1
   (`we:docs/agent/platform-decisions.md:70-74`): "code that delivers a capability at runtime →
   Frontier UI … **WE holds zero implementation**." The artifact-producing-render test that condemned WE's
   website (a *zero-impl* repo hosting a render) simply does not reach FUI — FUI is the tier runtime is
   *supposed* to live in. So the #2006 reasoning ("render = delivery = mis-homed") is inapplicable here.
2. **FUI's docs-site is a *render/showcase of the library*, not a product.** The product-frontend statute
   (`we:docs/agent/platform-decisions.md:1579`) homes *product composition* in "the product's own frontend
   (e.g. the WE website), not WE/FUI." A reference-implementation library documenting/showcasing **itself**
   is not product composition — it is the library's own reference surface. Nothing in FUI's docs-site
   composes a *product*; it renders the library's catalog and links the library's demos.

## Prior-art survey — how peer implementation libraries home their docs sites

The predictive discriminator from #2006's survey was **pure-render-of-the-thing (co-locate) vs
product-with-its-own-features (separate repo)**. Re-running that survey against the *right peer set* — UI
**component/implementation libraries** (not standards bodies or frameworks) — the dominant pattern inverts
#2006's answer:

- **Co-located in the library's own repo/monorepo (dominant):**
  - **Shoelace / Web Awesome** — a web-components library whose docs site is an **Eleventy** site living in
    the same repo, rendering the library's own custom elements. *Exact structural match to FUI* (Eleventy +
    web components + one repo).
  - **Material Web**, **Adobe React Spectrum**, **MUI**, **Chakra UI**, **Mantine**, **Ant Design**,
    **Carbon**, **Fluent UI** — docs co-located in the component monorepo.
  - Why: a component library's docs site is a **live dogfood showcase** that imports/renders the components
    it documents. Tight coupling (docs render the library's own catalog + demos) makes co-location the norm;
    the docs move version-locked with the components.
- **Separate repo (minority, framework/standard-scale):** React, Vue, Tailwind, TypeScript, JSON Schema —
  the same separate-repo camp #2006 leaned on, but these are *frameworks/standards* whose docs are large
  marketing+reference **products** with content far beyond a component showcase. A minority of component
  libraries (e.g. Radix's separate website repo) also separate, typically once the site grows a substantial
  marketing product.

**The discriminator predicts co-location for FUI:** FUI's docs-site is a pure reference-showcase of the
library (renders the library's catalog + demos, no independent product features), matching the
component-library co-locate camp — most tellingly the Shoelace/Web-Awesome Eleventy precedent. It is *not*
the framework/standard marketing-product shape that argues for separation.

## Classification (per-fork pass)

- **Q1 which layer?** The docs-site is FUI's own reference surface (impl-tier), not a WE standard artifact
  and not a Plateau product. It stays with the tier it documents.
- **Standing test — is this a fork?** Yes: the docs-site has exactly one terminal home; {co-located in FUI,
  extracted to its own product-tier surface} genuinely cannot both be it. But note the branch structure
  *differs* from #2006: there, permanent co-location was the *excluded/broken* branch (rule 1). Here
  **neither branch is broken** — co-location is legal (FUI holds runtime) *and* the peer norm; extraction is
  coherent but unnecessary. So it is a real either/or with a strongly-defaulted answer, not a forced-invariant
  ratify.
- **No interim/classifier fork (unlike #2006 Fork 2).** #2006 needed the site-root boundary + fail-closed
  classifier *because* the zero-impl invariant made every unclassified render a violation. FUI has no such
  invariant, so a machine-legible standard-vs-site classifier buys nothing here. FUI already de-facto
  separates the docs-site (`fui:src/` + `fui:.eleventy.js`) from the library (`fui:blocks/`, `fui:plugs/`,
  `fui:adapters/`) — noted as *supported by default*, not a fork.

## Recommendation

**One fork — end-state home of the FUI docs-site. Default: (a) co-locate in FUI.** FUI's docs-site is a
reference-showcase render of the library it documents, legitimately co-located per both constellation facts
(FUI holds runtime; the site is render-not-product) and the peer-library norm (Shoelace/Web-Awesome,
Material Web, MUI, Spectrum, …). Extraction (b) is the coherent-but-not-recommended alternative — reserved
for if/when the FUI docs-site grows genuine independent product features (its own marketing funnel, an app
beyond showcasing), at which point the #2006 extract-to-product-tier reasoning would begin to apply.

**Statute effect:** this would *distinguish* #2006, not duplicate it — a one-line note under constellation
placement that a reference-implementation tier's own docs/showcase site legitimately co-locates (the
product-vs-render test), the WE website being extracted only because WE holds zero impl *and* its site is a
product. No new anchor; a clarifying amendment at most, made at ratify time.
