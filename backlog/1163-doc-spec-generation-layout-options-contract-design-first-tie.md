---
type: decision
workItem: story
size: 3
parent: "1038"
status: open
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
preparedDate: "2026-06-20"
relatedReport: reports/2026-06-20-webdocs-doc-spec-generation-contract.md
tags: [webdocs, docs-as-code, generation-contract, conformance-vectors, decision-prep]
relatedProject: webdocs
---

# Doc Spec — generation layout + options contract (design-first, Tier-C)

WE-layer **Doc Spec** (webdocs): define the generation-layout + options **contract** the FUI generator
(`fui:webdocs/generator.ts`, from #424) conforms to. Tier-C child of the #1038 webdocs spec-surface epic.

## Digest

Grounded in the [Web Docs Doc Spec prior-art survey](/research/webdocs-doc-spec-generation-contract/)
([report](../reports/2026-06-20-webdocs-doc-spec-generation-contract.md)) — the navigation/options
contracts of the six leading docs generators (Mintlify, Docusaurus, VitePress, Astro Starlight,
Storybook, TypeDoc), constrained by the **#091 docs-as-code ruling**.

The webdocs *product* is built (#424/#425/#427) but its **WE-layer spec is greenfield**: `webdocs` is a
`status: poc` stub on the WE side ([we:src/_data/projects/webdocs.json](../src/_data/projects/webdocs.json))
with **no WE code surface** — the only running impl is FUI's generator. So this is a contract authored
*over a shipped impl*, not drawn cold, and the original item's "not file:line-groundable" blocker is
resolved: the forks ground against `fui:webdocs/generator.ts` + the statute layer. Three genuine forks
survive the standing test; everything else is settled by prior ruling, invariant, or is prioritization.

## Axis-framing

The shipped generator already pins most of the contract, *implicitly*, and that is the axis: the Doc Spec
makes those choices **normative WE contract** or leaves them impl-private. `WebManifest { id, name,
description?, blocks? }` ([fui:webdocs/generator.ts:83-89](../../frontierui/webdocs/generator.ts#L83)) has
exactly one layout-bearing field — `blocks?`, an optional ordered block-id list. `generateDocsSite`
([fui:webdocs/generator.ts:112-118](../../frontierui/webdocs/generator.ts#L112)) fixes the layout rules:
pages follow `manifest.blocks` order else stable id order; a non-empty `blocks` is the **scope source of
truth**; a manifest block with no cases still yields an (empty) page. The output is a **flat**
`DocsSite { pages: DocsPage[] }` data model ([:92-103](../../frontierui/webdocs/generator.ts#L92)) — not
rendered HTML. There are **zero options** (the pure `(manifest, cases) → DocsSite` signature).

The survey places this on the **derived ↔ authored** spectrum of docs-generator contracts: Mintlify's
single `docs`/`mint` JSON config (pure declarative single-manifest) is the docs-as-code archetype #091's
single-source-of-truth points at; Docusaurus/Starlight are the hybrid (declarative + `autogenerate{directory}` + frontmatter
override); Storybook/TypeDoc are fully derived from source. Hierarchy is universal at the sidebar level
(flat survives only in top nav) — so the generator's flat shape is the *immature* one, and
flat-vs-hierarchical is **now-vs-later**, not which-is-correct. The placement of the contract is settled
by the **#817/#855 statute** (types + golden conformance vectors → WE as `@webeverything/contracts/webdocs`
per #239/#700/#872; all runtime → FUI) — not a fork.

### Recommended path at a glance

Ratify all three rows, or override just the one you'd change. Confidence says where judgment is actually
needed vs. where to nod.

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 · contract strength** | deterministic, conformance-locked: WE owns the manifest→DocsSite mapping rules + golden vectors; any generator byte-equivalent on the same input | thin type-only contract, mapping is impl freedom *(rejected — breaks #091 no-drift)* | **High** |
| **2 · navigation model** | declarative-manifest authority + derived fallback: manifest is the authoritative TOC; blocks omitted ⇒ derive from cases, alphabetic | pure-derived (Storybook), no manifest authority *(rejected — contradicts #091 scope-SoT)* | **High** |
| **3 · options locus** | fold into the manifest as an open declarative `docs.*` extension; meta-schema standardized, not the list | a separate imperative `DocsOptions` argument *(rejected — second source that drifts)* | **Med-High** |

## Fork 1 — contract strength: conformance-locked spec vs thin type-only contract

*Fork exists because:* the thin type-only branch is **coherent but excluded** — it cannot satisfy #091's
requirement that Plateau-hosted docs not drift from self-hosted output (the "cancel and self-host always
holds" guarantee is empty if the two generators produce different sites from the same input). A standard
that ships only input/output *interfaces* and leaves the manifest→site mapping to each impl breaks that
guarantee. So this is a real either/or: lock the mapping, or don't.

- **(A — recommended) Deterministic, conformance-locked.** WE owns the manifest→`DocsSite` **mapping
  rules** (blocks = TOC order + scope SoT; alphabetic fallback; empty-page completeness) and ships a
  **golden conformance-vector suite** — `(manifest, cases) → expected DocsSite` pairs on the established
  kit ([we:conformance-vectors/schema.ts](../conformance-vectors/schema.ts), pattern
  [we:conformance-vectors/validator-resolution.vectors.ts](../conformance-vectors/validator-resolution.vectors.ts),
  #899/#1016). Any conforming generator (FUI self-host, Plateau-hosted) is **byte-equivalent** on the same
  input. Mirrors the in-repo determinism precedent — the module-service generator emits twice and throws
  `NonDeterministicBackendError` if outputs differ
  ([we:blocks/renderers/module-service/generation/generate.ts:7-8,47-48](../blocks/renderers/module-service/generation/generate.ts#L7),
  #463). Cost: the mapping rules become a frozen contract — changing them is a versioned contract change,
  not an impl tweak.
- **(B) Thin type-only contract** — WE ships `WebManifest`/`WebCases`/`DocsSite` interfaces only; the
  mapping is each generator's private behavior. Lighter to author and lets generators innovate on layout,
  but two conforming generators can produce different sites from one input, breaking #091's no-drift
  guarantee and the docs-as-code reproducibility that is the offering's whole point. *Rejected.*

*Confidence: High.* The residual is whether the golden vectors should also pin *rendered* output (no —
rendering is FUI's, per #817; vectors stop at the `DocsSite` model).

## Fork 2 — navigation model: declarative-manifest authority vs pure-derived

*Fork exists because:* the pure-derived branch (Storybook's "the content's own structure *is* the nav,
no manifest authority") is a **coherent, shipped model elsewhere** but is **excluded by #091** — which
makes the customer's `webmanifest` the source of truth for scope. The two cannot coexist: either the
manifest is authoritative over the TOC or the content is. The survey shows both are real industry choices,
so the deciding agent must consciously affirm the manifest-authority one rather than inherit it.

- **(A — recommended) Declarative-manifest authority + derived fallback.** The `manifest.blocks` list is
  the **authoritative TOC** — scope and order — exactly as the generator already does
  ([fui:webdocs/generator.ts:112-118](../../frontierui/webdocs/generator.ts#L112)); when `blocks` is
  omitted the generator **derives** the TOC from the cases in stable id order (the hybrid escape hatch,
  most-permissive default — omitting `blocks` auto-includes everything). This is the Mintlify
  single-manifest archetype the survey names as the docs-as-code fit, plus the Docusaurus/Starlight
  autogenerate fallback. Cost: a large doc set must list its blocks (or accept alphabetic) — no
  filesystem-folder-derived hierarchy in v1 (see *Supported by default*).
- **(B) Pure-derived, no manifest authority** — the docs structure is emergent from the cases (Storybook
  title-path model); the manifest contributes only identity. Lowest authoring friction, but the manifest
  is no longer the scope source of truth, contradicting #091's ratified docs-as-code model. *Rejected.*

*Confidence: High.* The residual is the fallback ordering when `blocks` is omitted (stable id /
alphabetic, as shipped — adequate; a smarter default is a later options concern, Fork 3).

## Fork 3 — options locus: fold into the manifest vs a separate options contract

*Fork exists because:* both branches are coherent and **genuinely cannot coexist** — you cannot
simultaneously hold "the manifest fully determines the output" (single source) and "a separate options
object also determines the output." One must own presentation. The standing *bias toward separation*
pulls one way; #091's single-source-of-truth pulls the other; that tension is the fork.

- **(A — recommended) Fold into the manifest as an open declarative `docs.*` extension.** Presentation
  knobs (case ordering, grouping, future hierarchy, per-page options) live under a webdocs-owned
  `manifest.docs.*` extension namespace — declarative, default-less, **open meta-schema** (standardize
  the extension point, not the option list — *Intents Open Design*; custom options coexist conflict-free).
  Keeps the generator's pure `(manifest, cases) → DocsSite` signature and #091 single-source (one
  reviewable artifact fully determines the site — the Mintlify per-node-field model). The project config
  extends a default-less base (*Config-Extends-Platform-Default*). Cost: presentation and identity share
  one file (the manifest), so the manifest envelope (owned by webmanifests, #1161) must reserve a
  webdocs-namespaced extension slot.
- **(B) A separate imperative `DocsOptions` argument** — a distinct options object passed to the
  generator alongside the manifest, splitting "what to document" (manifest) from "how to lay it out"
  (options), the TypeDoc/Storybook scope-vs-presentation separation. Cleaner conceptual split and the
  *separation bias*'s default, **but** it re-introduces a second source of truth that can drift from the
  manifest — the served site no longer reproducible from the manifest alone, weakening #091's guarantee.
  The separation the survey praises is scope-vs-presentation *within* one declarative artifact, which (A)
  delivers without a second runtime input. *Rejected.*

*Confidence: Med-High.* The residual is whether the `docs.*` namespace is owned by webdocs or
co-defined with webmanifests (#1161) — recommend webdocs owns the *interpretation*, webmanifests treats
the namespace as opaque pass-through (the seam below).

---

## Supported by default (no fork — invariant, prior ruling, or prioritization)

- **WE/FUI placement** — type contracts + golden vectors → WE (`@webeverything/contracts/webdocs` subpath
  on [we:contracts/package.json](../contracts/package.json), type-only re-export per the
  [we:contracts/lifecycle.ts](../contracts/lifecycle.ts) pattern); all runtime → FUI. The #817/#855
  statute, applied — ratify, don't re-litigate.
- **Distribution** — `@webeverything/contracts/webdocs`, type-only, #239/#700/#872 end-state.
- **Resolver / input shape** — `git | bundle | registry` behind one contract
  ([fui:webdocs/generator.ts:122-151](../../frontierui/webdocs/generator.ts#L122)); already settled by
  #091 Fork 1's sub-decision. Not re-opened.
- **Flat vs hierarchical (v1)** — **flat now, contract reserves a forward-compat hierarchy extension
  point.** The survey says hierarchy is the mature end-state (flat survives only in top nav), so
  "which is correct" is settled (hierarchical, eventually); flat-now-vs-hierarchical-now is therefore
  *prioritization* (now vs later), not a merit fork — and prioritization is decided at what-to-build-next
  time, not in the fork. v1 ships the flat shape matching the generator + the #1161 "carry richer fields,
  not drop them" theme (reserve, don't preclude). Build hierarchy when a consumer demands it.
- **The webdocs/webmanifests/webcases seam** — the Doc Spec *references* the base manifest envelope
  (webmanifests, #1161) and the case pivot (webcases, #1162); it owns only the docs-layout interpretation
  (the `docs.*` extension namespace + the mapping rules). No schema duplicated across the three specs.

## Per-fork classification (7-question pass)

- **Layer:** contract (types + vectors) → WE; mapping runtime → FUI (#817/#855).
- **Protocol or intent dimension:** a generator-conformance protocol, not a UX intent.
- **Expose the whole axis:** yes for options (Fork 3) — open meta-schema, default-less, project-extends.
- **Fixed mechanic or dimension:** navigation model (Fork 2) is a fixed mechanic (manifest authority is
  baked; pure-derived is excluded, not a co-equal end-state). Hierarchy depth is a deferred dimension.
- **DI-injectable:** the resolver transport (`fetchSource`) is injected; the mapping rules are not (they
  are the normative contract).
- **Most-permissive default:** yes — omitting `manifest.blocks` auto-includes every case block; an
  explicit `blocks` list is the author's opt-in restriction.
- **Seam between intents:** webdocs/webmanifests/webcases — each spec owns its own envelope; webdocs owns
  only the orchestration/layout interpretation.

## Preserved context (original item)

WE-layer Doc Spec (webdocs): define the generation-layout + options contract the FUI generator (#424,
`fui:webdocs/generator.ts`) conforms to. NOT batchable yet — no WE code surface exists (webdocs is a POC
project stub), so the seams are not file:line-groundable. Needs a design-first pass (survey + a
/research/ topic, constrained by the #091 docs-as-code ruling) before build slices can be carved. Tier-C
child of the #1038 webdocs spec-surface epic.
