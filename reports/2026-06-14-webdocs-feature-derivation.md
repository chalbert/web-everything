# Web Docs feature derivation — placement of the workbench feature surface against WE standards

> Prep research for decision **#626** (stage 3 of the Web Docs feature-pipeline epic #623). Takes the
> 20-feature matrix from #625 ([`we:src/_data/workbenchFeatures.json`](../src/_data/workbenchFeatures.json),
> published as [/research/workbench-feature-surface/](../src/_includes/research-descriptions/workbench-feature-surface.njk))
> and classifies every feature against the live registry — reuse / extend / mint, and at what layer.
> Published as the `/research/webdocs-feature-derivation/` topic.

## The shape of the decision

#625 already pre-sorted each feature with a `weStatus` column (reuse-existing / extend-existing /
new-surface / out-of-scope). Applying WE's **fork-existence test** (mandate nothing; a fork is real only
when branches are mutually-exclusive end-states), most of those classifications are **not decisions** —
they are placements ratified as written. The whole surface collapses to:

- **~11 ratify-as-classified reuse/extend/out-of-scope placements** — viewport→breakpoint, theming &
  token-tables→webtheme(+data-table), a11y→webcompliance, nav→nav-list/tree-select/breadcrumb,
  i18n→webintl, analytics→webanalytics, access-control→access-control+web-identity, extensibility→
  webplugs/webregistries; visual-regression + Figma-bridge → out-of-scope (CI/design-tool, served
  product #398). No judgment — classify and move on.
- **A small set of concrete blocks to mint** — `props-table`, `story-canvas`, `code-view` — forced by
  classification Q1 (runnable component code → Block) under the separation bias. Ratify as block mints;
  the *builds* spin off on ratification via a `blockedBy` chain (not at prep time).
- **Two genuine forks** where a real either/or remains: the component-metadata **interchange** (what
  carries block API metadata, and at what layer) and whether docs **examples are the webcases artifact**
  or a sibling concept.

## Prior art surveyed

### Custom Elements Manifest (CEM) — the component-metadata interchange

CEM (`we:custom-elements.json`) is the community spec for describing custom elements: a JSON file of
modules → declarations, each carrying attributes, properties, events, slots, CSS parts, CSS custom
properties, and methods. Current schema **2.1.0**, with a top-level `schemaVersion` for evolution; the
`@custom-elements-manifest/analyzer` emits it from source, and authors advertise it via a
`"customElements": "we:./custom-elements.json"` pointer in `we:package.json`.

The load-bearing fact for #626 is its **consumer set**: api-viewer renders API tables + a live demo +
auto-generated controls off one manifest; Storybook (web-components) ingests it; VS Code custom-data /
`wc-info` and JetBrains web-types drive editor IntelliSense from it; linters warn on unknown elements
from it. That is a **manifest consumed by many independent vendors that do not share an engine** — which
is exactly WE's litmus for a **Protocol** (classification Q2: reach for a protocol only when many
vendors must interoperate). WE already hosts this exact shape: the `changelog-manifest` protocol
([`we:protocols.json:94`](../src/_data/protocols.json)) is a declarative manifest consumed by multiple
independent tools off one seam (the MF2 `we:mf-manifest.json` one-seam-many-consumers lesson). CEM is the
same pattern for component API metadata.

Crucially: WE has **no `formats` registry**. The matrix's `format:custom-elements-manifest` /
`format:csf` / `format:api-viewer` refs point at a registry that does not exist — so the entity-kind is
a genuine open call, not a lookup. The choices reduce to *adopt CEM as a `protocol`*, *mint a bespoke
WE manifest format*, or *treat it as tooling with no registered entity*. Adopting the existing CEM as a
protocol reuses platform vocabulary (native-first), inherits its consumer ecosystem for free, and keeps
the single escapable lock the protocol layer is for.

### api-viewer — the zero-build proof of the isolation + autodocs + args triad

api-viewer is a web component that, given a CEM, renders a component in isolation, its API tables, and a
live knobs panel — no build step, no framework. It proves the three "new-surface" render features
(`component-isolation`, `autodocs`, `args-controls`) are **one capability fed by one manifest**, not
three independent builds. This is what lets the isolation renderer + props-table + args panel all be
**webdocs project capabilities composing CEM**, rather than a sprawl of unrelated machinery.

### CSF (Component Story Format) — already covered; ingest, don't re-mint

The stories/examples question's *ingestion* half is fully surveyed in the
[#426 webdocs-incumbent-ingestion-adapters](../src/_includes/research-descriptions/webdocs-incumbent-ingestion-adapters.njk)
topic: CSF3 = one Meta default + N named Story exports; a webcases adapter reads it via
`@storybook/csf-tools` and emits the webcases pivot `WebCase = {id,title,description,code}`
(`fui:webdocs/generator.ts:27-46`). That topic already establishes the **webcases pivot is the normalization
target** for incumbent stories — which is the strongest evidence for Fork 2's recommended branch (docs
examples ARE webcases): the ingestion path already lands stories *in webcases*.

### Pagefind — search is reuse + a build step, not a new standard

Pagefind (Starlight's default search) is a Rust→WASM static-search library: it indexes the built HTML at
build time, shards the index, and lazy-loads chunks in the browser — no SaaS, no API key, no per-query
cost. This reframes the matrix's "new-surface" search classification: the **input UI reuses existing
blocks** (`autocomplete`/`type-ahead`), and the **index is a build-time tooling step** (a Pagefind-shaped
static artifact), not a WE standard. There is no multi-vendor interop story for the index format, so it
is *not* a protocol (Q2) — it is composition + tooling. Search drops from "mint" to "reuse + build step."

### Starlight / Pattern Lab — native-first donors for the read surface

Long-form docs: Starlight's near-zero-JS markdown model is the donor; the WE read surface is the existing
11ty/markdown pipeline + a **block-embed directive**, *not* the `webediting` WYSIWYG authoring project
(which is unregistered — only proposed by #618 — and belongs to the served product's *authoring* UX, not
the catalog's *read* surface). Navigation/IA: Pattern Lab's Atomic-Design taxonomy over the existing
`nav-list`/`tree-select`/`breadcrumb` blocks.

## Classification verdicts (the build plan #626 ratifies)

| Feature | Verdict | Lands at |
|---|---|---|
| component-isolation | extend (was "new") | webdocs capability composing CEM (api-viewer pattern) |
| autodocs | extend (was "new") | webdocs capability rendering CEM → `props-table` **block** |
| args-controls | extend | Technical Configurator fed by CEM |
| source-code-view | mint | `code-view` **block** (+ data-transfer copy); sandbox embed out-of-scope |
| multiple-states (stories) | **Fork 2** | webcases (recommended) vs sibling `examples` |
| interaction-tests | extend | webcases conformance fixtures (folds into Fork 2) |
| component-metadata (new) | **Fork 1** | CEM as a `protocol` (recommended) |
| search | reuse + tooling (was "new") | input blocks + Pagefind build step |
| long-form-docs | extend | 11ty/markdown + block-embed directive (not webediting) |
| viewport, theming, token-tables, a11y, nav-IA, i18n, analytics, access-control, extensibility | reuse | as pre-classified in the matrix |
| versioning | extend | doc snapshots + webadapters migration content |
| conformance-badge (thread) | reuse | capabilityMatrix output (presentation, like the a11y panel) |
| persona-lensed IA (thread) | reuse | persona-preset primitive (#564/#622) as a filter lens |
| visual-regression, Figma bridge | out-of-scope | CI/hosted + design-tool → served product #398 |

## The two genuine forks (carried to #626's prepared shape)

1. **Component-metadata interchange & layer.** Adopt CEM as a new WE **`protocol`** (changelog-manifest
   precedent; native-first; free consumer ecosystem) — *recommended* — vs mint a bespoke WE manifest
   format vs tooling-only with no entity. Confidence **high**.
2. **Docs examples ↔ webcases.** Docs "examples/stories" (and interaction-tests) **are the webcases
   artifact** — one fixture serves conformance + docs; ingestion already lands stories in webcases —
   *recommended* — vs a sibling docs-only `examples` concept (honours separation bias but duplicates the
   fixture and forks the ingestion target). Confidence **med** (separation bias pulls back).

Everything else is a ratify-as-classified placement. Per "lead with the decision, quarantine the
context," #626's body carries only these two forks above the divider; the full classification table sits
under `## Context`.
