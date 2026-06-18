# Design-reference corpus — taxonomy seed & first-run scope (prior-art survey)

_Date: 2026-06-12 · feeds backlog [#394](../backlog/394-design-ref-corpus-first-run-scope-taxonomy-seed-grow-targets.md)
(Fork 3 of the [#382](../backlog/382-design-reference-screenshot-corpus-collect-dedup-codify.md) corpus epic) ·
research topic: [/research/design-ref-taxonomy/](https://webeverything — `design-ref-taxonomy`)_

## Why this survey

[#382](../backlog/382-design-reference-screenshot-corpus-collect-dedup-codify.md) shipped a working,
idempotent screenshot-collection pipeline (`we:scripts/design-refs.mjs`, content-addressed WebP, inclusion
gate, browse gallery). Its only remaining open fork is **Fork 3 — first-run scope & taxonomy seed**
(carved out as #394): _which app categories and design registers to cover, how many shots each, and how
to grow `we:design-refs/targets.json` beyond the 16-app proof set._ The proof set is heavily skewed —
12 of 16 are dev-tools / editors / code-playgrounds — so the corpus is thin everywhere else.

Before authoring the seed we surveyed how the established reference-screenshot galleries and the
information-architecture literature taxonomise app UIs, so the seed borrows proven vocabulary instead of
being invented cold.

## What the prior art does

### 1. Reference galleries use a faceted, multi-axis model — not one tree

**Mobbin** (1,150+ apps, 608k+ screens, 323k+ flows) organises content along **independent facets** you
combine: **app category** (Business, Education, Entertainment — _domain/industry_), **UI patterns / flows**
(login, checkout, onboarding, subscription — _task journeys_), and **UI elements** (tab bars, buttons,
cards — _components_), plus **platform** (iOS/Android/web) and a **design-trend** facet. Search is by app,
flow, pattern, screen type, and category — orthogonal axes, not a single hierarchy.

**Page Flows** and **Screenlane** lead with a **screen-type** axis: onboarding, home/feed, discover,
profile, settings, paywall, checkout, search, empty states, error states, chat, pricing, billing,
dashboards. This is the dominant organising axis of flow-oriented galleries.

> **Mapping to our schema:** the `category` field ≈ Mobbin's app-category facet; `surface` ≈ the
> screen-type axis; `designRegister`/`theme` ≈ the design-trend facet. #382 already deferred per-screenshot
> visual tagging (`surface`, refined register, theme) to the phase-3 vision pass — consistent with the
> galleries treating screen-type as a per-screen, not per-app, property.

### 2. "Design register" conflates two orthogonal things

Our current `we:targets.json` `designRegister` values mix **product archetypes** (`enterprise-dense`,
`modern-saas`, `utilitarian`) with **visual aesthetics** (`minimal`, `dark-dev`, `minimal-hand-drawn`,
`friendly-minimal`). The design literature treats these as a separate, well-named vocabulary of
**visual styles**: skeuomorphism → flat → material → minimalism → neumorphism → glassmorphism →
neobrutalism → claymorphism / hyperrealism. A "modern-SaaS" product can render flat _or_ glassmorphic —
archetype and aesthetic vary independently. The exercise-app program already uses **product archetypes**
(enterprise-finance vs modern-SaaS, as `theme-<register>` token layers); the visual-style vocabulary is a
_different_ axis the corpus should carry separately.

### 3. Controlled vocabulary vs folksonomy — the resolved answer is "faceted controlled vocabulary that grows"

The IA literature is explicit: a **closed taxonomy** gives consistent, comparable structure but is rigid;
a **folksonomy** (free-text tags) is flexible but suffers synonym/polysemy/noise and defeats retrieval.
The documented resolution is a **faceted controlled vocabulary** — facets seeded from a controlled list,
allowed to grow, with new values curated into a registry to catch synonyms. The big SaaS directories
behave exactly this way: G2 (2,000+ categories), Capterra (~1,000), Crozdesk (377) each maintain an
**evolving, keyed** category taxonomy and add categories monthly — and each is _different_, so reuse means
borrowing a coarse top level, not adopting 2,000 leaves.

> **Repo precedent:** this is the same shape as `we:src/_data/benchmarkCorpus.json` — a keyed corpus whose
> entries carry stable ids so a re-run produces a clean diff (added / dropped / re-categorised) rather than
> a rewritten list. The taxonomy seed should live in the same kind of keyed, append-friendly registry.

## Implications for #394 (carried into the prepared forks)

1. **Split the register axis** into `productRegister` (archetype — deterministic, author-supplied at target
   time) and `visualStyle` (named aesthetic — perceptual, _deferred to the vision pass_ per #382 Fork 2).
   This both honours bias-toward-separation and _reduces_ collect-time curation.
2. **Vocabulary = open-growing controlled vocabulary**, seeded canonical values in a keyed
   `we:design-refs/taxonomy.json` registry (mirrors `we:benchmarkCorpus.json`), new values allowed but registered.
   Not a closed schema enum (blocks new domains mid-run), not free-text (synonym noise).
3. **First-run scope = scarcity-weighted grow-targets**, not a flat per-category count: drive the corpus
   toward ≥K shots per under-covered cell, prioritising the registers thin today (everything outside
   dev-tools/editors), landing ~30–50 the first run — operationalising the item's "prioritise registers the
   corpus currently lacks." The quota is a _grow-target_ the worklist tracks, not a hard cap.
4. **Category seed = a coarse ~10-domain hand-roll, lightly anchored** to G2/Capterra top-level names where
   they map, recorded in the registry — full external-taxonomy adoption is over-engineering at this scale.

## Architectural classification

This is **internal research-corpus tooling** (`design-refs/`), not a Web Everything standard — no intent,
block, plug, protocol, or adapter, and **zero project-facing surface or lock-in** (it's a dev-time corpus).
So the taxonomy is a configurable dimension (open-growing vocab) with most-permissive defaults
(grow-target not hard cap), and the one real seam is **deterministic target-level curation**
(`productRegister`, `category`) vs **per-screenshot vision-pass tagging** (`visualStyle`, `surface`) —
exactly the seam #382 Fork 2 already drew.

## Sources

- [Mobbin — UI & UX design inspiration](https://mobbin.com/) · [mobbin-mcp (taxonomy facets)](https://github.com/pdcolandrea/mobbin-mcp)
- [Page Flows — screen types](https://pageflows.com/ios/screens/) · [Screenlane](https://screenlane.com/)
- [Big Human — graphic/UI design styles guide](https://www.bighuman.com/blog/graphic-design-styles-guide) ·
  [DesignerUp — popular UI design styles](https://designerup.co/blog/here-are-6-5-of-the-most-popular-ui-design-trends-and-how-to-design-them/)
- [Webology — Folksonomies: why do we need controlled vocabulary?](https://www.webology.org/2007/v4n2/editorial12.html) ·
  [A Facet Analysis of a Folksonomy (Journal of IA)](https://journalofia.org/volume2/issue2/02-conradi/)
- [G2 / Capterra category taxonomy scale](https://www.g2.com/products/capterra/features)
