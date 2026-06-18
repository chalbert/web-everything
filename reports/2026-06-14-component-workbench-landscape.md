# The component-workbench / docs-tool landscape — Storybook and its peers

> Session artifact for [#624](/backlog/624-inventory-the-component-workbench-docs-tool-landscape-storyb/)
> (under the Web Docs feature-pipeline epic [#623](/backlog/623-web-docs-feature-pipeline-inventory-workbench-tools-derive-i/),
> sibling of the served product [#398](/backlog/398-build-the-web-docs-product-fui-open-primitives-plateau-app-o/)).
> Published as the `/research/` topic **component-workbench-landscape**; the registry lives in
> [`we:src/_data/workbenchTools.json`](../src/_data/workbenchTools.json). Prior art = the live state of each
> tool plus the two already-named ingest targets (Storybook, Mintlify, in
> [#426](/backlog/426-incumbent-ingestion-adapters-storybook-mintlify-to-the-webca/)); not a greenfield
> standards survey. Mirrors the benchmark-corpus precedent: a registry + a report + a research topic, with
> governed, reproducible membership.

## Why this inventory exists

The Web Docs constellation had a **product half** (the served site #398, real-block render #604, the
Storybook+Mintlify ingestion adapters #426/#550) but no answer to the prior question: **what is a
component-workbench actually made of, and which tools is Web Docs competing with or ingesting from?**
Only two tools (Storybook, Mintlify) had ever been named. This report enumerates the whole landscape so
the next two pipeline stages have a complete source list: the feature-surface sweep
([#625](/backlog/625-inventory-the-full-feature-surface-across-workbench-tools/)) cross-tabs capabilities
across these tools, and the derivation decision
([#626](/backlog/626-map-workbench-features-to-we-standards-which-intents-blocks-/)) classifies each
capability mint-new vs reuse-existing against WE standards.

**This corpus is complementary to, not a duplicate of, `we:benchmarkCorpus.json`.** That corpus is the set of
*design systems* (what Web Docs would render and benchmark for coverage). This one is the set of *tools
that document design systems* (what Web Docs competes with as a product and ingests from as adapters). One
is the content; this is the container.

## The five axes (not one flat list)

The landscape only makes sense categorized, because the tools answer different questions and have different
business models. The registry uses five category axes:

| Axis | What it is | Model | Exemplars |
|---|---|---|---|
| **Local component workbench** | Renders components in isolation from source/stories, in-repo | local, OSS | Storybook, Histoire, Ladle, React Styleguidist, Pattern Lab |
| **Docs platform / site generator** | Long-form docs sites with examples interleaved | local OSS *or* hosted | Docusaurus, Nextra, Starlight; Mintlify, GitBook, ReadMe |
| **Hosted design-system catalog** | SaaS browsable catalog, often Figma↔code | hosted, commercial | Zeroheight, Supernova, Knapsack, Bit; Backlight *(retired)* |
| **Visual-test / publish** | Snapshot/diff rendered components + review workflow | hosted *or* OSS | Chromatic, Percy, Applitools; Lost Pixel *(OSS)* |
| **Machine-readable inventory format** | Schema describing a component's API + examples | open spec / format | CEM, CSF3, web-types, api-viewer, react-docgen |

Two structural observations fall out of the axes:

- **The local↔hosted and OSS↔commercial splits track the open-core seam.** Every commercial tier
  (Chromatic, Zeroheight, Knapsack, Mintlify-hosted) has an OSS or self-hostable counterpart (Lost Pixel,
  Docusaurus/Starlight, Storybook). This is exactly the open-core shape #398 plans for Web Docs: the
  catalog/render surface is free and self-hostable; the hosted/managed conveniences (visual-test cloud,
  per-customer conformance, analytics) are the paid tier. The market has already validated that seam.
- **The inventory-format axis is the load-bearing one for WE.** A workbench is a renderer over a format.
  Whoever owns the *format* owns the interoperability. This is where WE's web-component-native nature
  becomes an advantage rather than a catch-up.

## How each maps to the WE constellation

Every source carries a `weRoles` tag (`benchmark` / `ingest-target` / `feature-donor` / `format-to-emit`).
The mapping in plain terms:

### Ingest targets (adapters that read incumbents → the WebCatalog)
The #426 adapters already cover **Storybook** (CSF) and **Mintlify** (MDX). The landscape says the next
adapters worth their cost are format-level, not tool-level:
- **CEM (Custom Elements Manifest)** — the single highest-value ingest *and* emit format (see below).
- **CSF3** — already covered via Storybook, but note it is portable: Ladle reads it too, so a CSF adapter
  ingests from more than one workbench.
- **react-docgen** — the dominant React autodocs source; an ingest surface for the large React-component
  population, but explicitly **not** a format WE should emit.

The hosted catalogs (Zeroheight, Supernova, Knapsack, Bit) are **benchmark-only**, not ingest targets:
they are closed SaaS without a clean machine-readable export, so the cost of an adapter is not justified.

### Format to emit (what a WE-native docs surface produces)
**Custom Elements Manifest is the answer.** It is web-component-native, declarative JSON (tags, attributes,
properties, slots, events, CSS parts/vars), generated by a standard analyzer, and already consumed by
Storybook-for-web-components, api-viewer, and IDEs. Because WE's blocks are custom-element-aligned, emitting
CEM lets *existing* tools document WE components for free. **`api-viewer` is the proof of concept**: a single
web component that renders CEM as live docs + a props playground with no build step — the closest existing
analog to a WE-native docs element. web-types (JetBrains) is the IDE-tooling sibling format; emit it only if
editor-integration parity is wanted, but CEM is the more standards-aligned primary.

### Feature donors (capabilities to harvest into intents/blocks in #625/#626)
- **Storybook** — args/controls, autodocs, the addon model, and (v9) integrated test/a11y/visual.
- **Starlight** — native-first: ships near-zero JS, framework-agnostic. The philosophical model for a
  WE-native surface.
- **Chromatic / Lost Pixel** — visual-test + approval as a *publishing* step (Lost Pixel is the OSS shape).
- **Supernova / Bit** — design-token tables and per-component versioning as publishing primitives.
- **Pattern Lab** — the Atomic Design taxonomy (the IA of a catalog), independent of its template engine.
- **Zeroheight** — the design↔code bridge as a first-class concern.

## Currency signals worth recording

Three statuses in the registry are themselves findings, not just metadata:

1. **Backlight is RETIRED** (divRIOTS shut it down **1 June 2025**). The fully-hosted "design-system IDE in
   the browser" was the most ambitious hosted model, and it did not endure. **Signal for #626:** WE should
   *not* invest in a browser-based hosted authoring IDE; the durable models are local-OSS-workbench +
   hosted-thin-conveniences.
2. **React Styleguidist and Pattern Lab are RETIRING** (low activity, superseded by Storybook autodocs and
   the JS-component era respectively). Their *ideas* survive (docs-from-source; Atomic Design taxonomy) even
   though the tools faded — harvest the idea, not the tool.
3. **Histoire is pre-v1 with effectively one maintainer.** A sustainability caution: its Vite-native model
   and component-as-story authoring are donor ideas, but it is not a stable thing to depend on.

Storybook itself remains the category anchor: **v9 (June 2025)** folded interaction tests, a11y, visual
testing, and coverage into core ("Storybook Test", Vitest-backed) — meaning the feature surface #625 sweeps
is now broader at the top end than the older "render + controls + docs" framing assumed.

## What this feeds

- **#625 (feature surface)** — every tool here is a column in the tool×capability matrix; the donor notes
  above are the starting capability axes.
- **#626 (derive → WE standards)** — the `weRoles` tags pre-classify each source (ingest/emit/donor/
  benchmark); the decision then classifies each *capability* mint-vs-reuse. The two strongest priors this
  report hands #626: **(a) CEM is the format to emit** (web-component-native, already tool-consumed), and
  **(b) the open-core seam is market-validated** (free OSS workbench + paid hosted conveniences).
- **#426/#550 (adapters)** — confirms which adapters beyond Storybook/Mintlify earn their cost:
  **format-level CEM and CSF3, plus react-docgen for React reach**; hosted catalogs are benchmark-only.

## Method note (reproducibility)

Membership is governed by `selectionCriteria` + `inclusionRule` in the registry (a tool qualifies if it
occupies one of the five axes and scores on ≥2 other criteria). Retired/retiring tools are deliberately
kept — their decline is evidence. Tool statuses verified against live sources on 2026-06-14 (Storybook 9.x
release notes; Backlight shutdown notice; Histoire maintenance discussions). Re-running the sweep means
re-checking each `status`/`lastChecked` and adding any new entrant that clears the inclusion rule, exactly
as the benchmark-corpus sweep does.
