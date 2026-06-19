---
type: decision
workItem: story
size: 5
parent: "623"
status: resolved
blockedBy: ["625"]
dateOpened: "2026-06-14"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#project-protocol-bar"
preparedDate: "2026-06-14"
relatedProject: webdocs
relatedReport: reports/2026-06-14-webdocs-feature-derivation.md
tags: [webdocs, decision, placement, intents, blocks, adapters, derivation]
---

# Map workbench features to WE standards — which intents/blocks/adapters/protocols to mint vs reuse

**Placement/derivation decision — prepared, ready to ratify.** Classify the 20-feature matrix from
[#625](/backlog/625-inventory-the-full-feature-surface-across-workbench-tools/)
([`we:workbenchFeatures.json`](../src/_data/workbenchFeatures.json)) against the live registry. No fresh design
exists; the call is grounded in the published `/research/` topic
[webdocs-feature-derivation](/research/webdocs-feature-derivation/) (report linked via `relatedReport`).
Applying the **fork-existence test**, the surface collapses to **~11 ratify-as-classified placements**, a
**forced block-mint set**, and **only two genuine forks** — each carrying a **bold** recommended default
below. Output is the build plan that feeds the surface assembly
([#627](/backlog/627-assemble-the-web-docs-component-catalog-surface-from-the-der/)).

This is mostly a *classification* decision, not a fork-storm: most of #625's `weStatus` placements are
"support all coherent / dedupe against the registry," which the standing test says are **not decisions** —
ratify and move on. The research decomposed the genuinely-open part into two orthogonal axes: (1) the
**component-metadata interchange** — what artifact carries a block's API metadata, and at what *layer*
(the matrix invented `format:*` refs against a registry that doesn't exist —
[`we:projects.json`](../src/_data/projects.json) has projects, [`we:protocols.json`](../src/_data/protocols.json)
has 28 protocols, there is **no `we:formats.json`** — so the entity-kind is a real call); and (2) the
**examples↔webcases** boundary — whether docs "stories/examples" are the existing webcases fixture or a
sibling concept, a combine-vs-split call against the bias-toward-separation. The render triad
(`component-isolation` / `autodocs` / `args-controls`) is *one* capability fed by one manifest (api-viewer
proves it), so it lands as webdocs capabilities composing CEM, not three new builds.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 — Component-metadata interchange & layer** | **Adopt Custom Elements Manifest (CEM) as a new WE `protocol`** | Bespoke WE manifest format · tooling-only (no entity) | High |
| **2 — Docs examples ↔ webcases** | **Examples *are* webcases** (one fixture serves conformance + docs; interaction-tests fold in) | Sibling docs-only `examples` concept | Med |

Everything below the `## Context` divider (the 20-feature classification table + the forced block mints) is
**ratify-as-classified**, not part of the call.

## Ruling — ratified 2026-06-15

Both forks ratified to their recommended defaults; the 20-feature classification and the forced block mints
adopted as-classified.

- **Fork 1 — Component-metadata interchange & layer → A.** Adopt Custom Elements Manifest (CEM,
  `we:custom-elements.json`, schema 2.1.0) as a new WE `protocol` (`custom-elements-manifest`) — its cross-vendor
  interop is exactly the protocol litmus, and adopting the open spec keeps the single escapable lock while
  inheriting the api-viewer/Storybook/VS Code/JetBrains consumer ecosystem. *Sub-decision:* the API-table
  renderer is a `props-table` block over CEM; the args/controls panel is the Technical Configurator fed by
  CEM — **not** a new control standard.
- **Fork 2 — Docs examples ↔ webcases → A.** Examples *are* webcases: one fixture serves both the conformance
  loop and the docs surface; a `story-canvas` block renders a webcase in isolation; interaction-tests fold in
  as webcases with an interaction script; docs-only presentation needs become optional webcase fields, not a
  second artifact. (The #426 ingestion adapters already normalize incumbent stories into webcases — splitting
  would fork that target.)
- **Classification + forced block mints adopted as-classified** (the `## Context` table): 11 reuse/extend
  placements feed #627 directly; three block mints spin out as builds.

**Spun out at ratification** (filed under epic #623, in `blockedBy` order):

- [#653](/backlog/653-register-custom-elements-manifest-cem-as-a-we-protocol-emit-/) — register CEM as a WE protocol + emit pipeline (blockedBy #626)
- [#654](/backlog/654-mint-the-props-table-block-render-custom-elements-manifest-a/) — mint the `props-table` block (blockedBy #653 — needs CEM)
- [#655](/backlog/655-mint-the-story-canvas-block-render-a-webcase-in-isolation/) — mint the `story-canvas` block (blockedBy #626)
- [#656](/backlog/656-mint-the-code-view-block-syntax-highlighted-source-with-copy/) — mint the `code-view` block (blockedBy #626)

These feed the catalog surface assembly [#627](/backlog/627-assemble-the-web-docs-component-catalog-surface-from-the-der/); its `/blocks/` index slice was already safe to start independent of these mints.

## Fork 1 — Component-metadata interchange & its layer

**Crux.** Autodocs, the isolation renderer, and the args panel all need a machine-readable description of a
block's attributes/properties/events/slots/CSS-API. What artifact carries it, and what WE entity-kind does
it become? The matrix wrote `format:custom-elements-manifest` ([`we:workbenchFeatures.json:39`](../src/_data/workbenchFeatures.json#L39),
[:87](../src/_data/workbenchFeatures.json#L87)) but there is **no `formats` registry** to hold it — so the
layer is unresolved. The relevant precedent is the `changelog-manifest` **protocol**
([`we:protocols.json:94`](../src/_data/protocols.json#L94)): WE already treats a declarative manifest consumed
by multiple independent tools as a protocol (the one-seam-many-consumers shape).

- **A — Adopt CEM as a new WE `protocol`. ✅ recommended.** Custom Elements Manifest (`we:custom-elements.json`,
  schema 2.1.0) is the de-facto multi-vendor spec, consumed by api-viewer, Storybook (web-components), VS
  Code custom-data, JetBrains web-types, and linters off one file. That cross-vendor interop is *exactly*
  WE's protocol litmus (classification Q2 — reach for a protocol only when many vendors must interoperate).
  Adopting the existing spec reuses platform vocabulary (native-first), inherits its consumer ecosystem for
  free, and keeps the protocol as the single escapable lock. A new `we:protocols.json` entry
  (`custom-elements-manifest`) plus the emit pipeline from WE blocks; renders the API tables as a
  `props-table` block. *Tradeoff:* WE binds to an external schema's evolution — mitigated by CEM's own
  `schemaVersion` field.
- **B — Mint a bespoke WE component-manifest format.** *Rejected* — no interop gain, and it forfeits the
  entire CEM consumer ecosystem; minting a lock for a problem an open spec already solves violates
  minimize-lock-in and native-first.
- **C — Tooling-only (emit CEM, register no entity).** *Rejected* — CEM is consumed across the constellation
  (autodocs, editor IntelliSense, ingestion); leaving it unregistered makes it a hidden contract. It *is* a
  conformance contract independent impls produce, so it earns a protocol home.

*Sub-decision (settled by A):* the API-table renderer is a **`props-table` block** rendering CEM output;
the args/controls panel is the **Technical Configurator fed by CEM**
([`we:intents.json:1160`](../src/_data/intents.json#L1160) input / [:1118](../src/_data/intents.json#L1118)
selection), *not* a new control standard.

## Fork 2 — Docs examples ↔ webcases

**Crux.** Docs need "multiple states / stories per component" (`we:workbenchFeatures.json:42`) and
interaction-tests (`:150`). WE already has **webcases** ([`we:projects.json:208`](../src/_data/projects.json#L208),
`concept`) as the conformance-fixture artifact, and the #426 ingestion adapters already read CSF and emit
the webcases pivot `WebCase = {id,title,description,code}` (`fui:webdocs/generator.ts:27-46`, surveyed in
[/research/webdocs-incumbent-ingestion-adapters/](/research/webdocs-incumbent-ingestion-adapters/)). Is a
docs "example" the same row as a conformance "case," or a sibling concept?

- **A — Examples *are* webcases. ✅ recommended.** One fixture artifact serves both the conformance loop and
  the docs surface; a `story-canvas` block renders a webcase in isolation. Interaction-tests fold in as
  webcases with an interaction script. *Decisive evidence:* the ingestion adapters **already** normalize
  incumbent stories *into* webcases — splitting now would fork that target. *Tradeoff:* docs may want
  presentation metadata (ordering, prose) a conformance case lacks — added as optional webcase fields, not a
  second artifact.
- **B — Sibling docs-only `examples` concept.** *Rejected as default.* It honours bias-toward-separation,
  but the named cost overrides it here: it duplicates a fixture webcases already models, forks the ingestion
  normalization target, and splits the conformance/docs loops that want to share one source of truth. The
  separation bias yields when the split has a concrete cost — it does. (Confidence **med**: this is the one
  row where the standing bias actively pulls the other way, so it is the real judgment call.)

## Context

Everything here is **ratify-as-classified** — placements the fork-existence test demotes out of "decision."

### Classification verdicts (the build plan #626 ratifies)

| Feature | Verdict | Lands at |
|---|---|---|
| component-isolation | extend (was *new*) | webdocs capability composing CEM (api-viewer pattern) |
| autodocs | extend (was *new*) | webdocs capability → **mint `props-table` block** (renders CEM) |
| args-controls | extend | Technical Configurator fed by CEM |
| source-code-view | mint | **mint `code-view` block** (+ `data-transfer` copy, [`we:intents.json:1990`](../src/_data/intents.json#L1990)); sandbox embed out-of-scope |
| multiple-states (stories) | **Fork 2** | webcases (rec.) → **mint `story-canvas` block** vs sibling `examples` |
| interaction-tests | extend | webcases conformance fixtures (folds into Fork 2) |
| component-metadata | **Fork 1** | CEM as a `protocol` (rec.) |
| search | reuse + tooling (was *new*) | `autocomplete`/`type-ahead` blocks + Pagefind build step |
| long-form-docs | extend | 11ty/markdown + block-embed directive (**not** webediting — unregistered, #618) |
| viewport-responsive | reuse | `breakpoint` intent ([`we:intents.json:984`](../src/_data/intents.json#L984)) |
| theming-switch / token-tables | reuse | webtheme ([`we:projects.json:280`](../src/_data/projects.json#L280)) + `data-table` block |
| a11y-panel | reuse | webcompliance ([`we:projects.json:307`](../src/_data/projects.json#L307)) output (presentation) |
| navigation-ia | reuse | `nav-list` / `tree-select` / `breadcrumb` blocks |
| i18n-docs | reuse | webintl ([`we:projects.json:181`](../src/_data/projects.json#L181)) |
| analytics | reuse | webanalytics ([`we:projects.json:123`](../src/_data/projects.json#L123)) |
| access-control-metered | reuse | `access-control` + `web-identity` intents (powers #398 open-core) |
| extensibility-addons | reuse | webplugs / webregistries |
| versioning | extend | doc snapshots + webadapters migration content |
| conformance-badge *(thread)* | reuse | capabilityMatrix output — presentation, like the a11y panel ([`we:capabilityMatrix.json`](../src/_data/capabilityMatrix.json)) |
| persona-lensed IA *(thread)* | reuse | persona-preset primitive (#564/#622) as a filter lens — not new docs-only nav |
| visual-regression | out-of-scope | CI/hosted → served product #398 |
| design-code-bridge | out-of-scope | design-tool integration → served product #398 |

### Forced block mints (ratify; *builds spin off on ratification*)

Three concrete components with runnable code → **Block** by classification Q1, under the separation bias:
`props-table` (renders CEM API), `story-canvas` (renders a webcase in isolation), `code-view` (syntax-
highlighted source + copy). These are **named here, not built here** — per the prepared-decision pattern,
their batchable build items are filed under epic #623 with a `blockedBy` chain on this decision *at
ratification*, not at prep time.

### Consciously omitted (WE will not replicate)

Visual regression (CI/hosted, Chromatic-vs-Lost-Pixel → #398 hosted tier) and the Figma design↔code bridge
(design-tool integration; its fully-hosted form, Backlight, already failed per #624).

### Design threads resolved

- **Conformance badge** → reuse: the `capabilityMatrix` already computes per-block conformance; the badge is
  a *presentation* of its output (same pattern as the a11y panel presenting webcompliance), not a new block.
- **Persona-lensed IA** → reuse: the persona-preset primitive (#564/#622) supplies the filter lens; the
  catalog IA composes it, no docs-only nav standard.

### Sequencing

Resolving this names the build items #627 assembles. The minimal first slice (`/blocks/` index) is already
safe to start under #627 independent of these mints. Per the prepared-decision pattern, ratification spins
out: CEM protocol entry → `props-table` / `story-canvas` / `code-view` block builds → wired into #627's
surface, in `blockedBy` order.
