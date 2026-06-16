---
type: idea
workItem: story
size: 3
parent: "623"
status: resolved
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: none
relatedProject: webdocs
tags: [webdocs, storybook, inventory, landscape, benchmark, registry]
---

# Inventory the component-workbench / docs-tool landscape (Storybook & peers)

Consolidated landscape of Storybook-like tools — **no such inventory exists today** (only Storybook + Mintlify were
named in [#426](/backlog/426-incumbent-ingestion-adapters-storybook-mintlify-to-the-webca/)/#429). Publish a `reports/`
landscape + `src/_data/workbenchTools.json` registry, mirroring the
[benchmarkCorpus](../src/_data/benchmarkCorpus.json) pattern (registry + report + research topic).

## Categorize on axes (not one flat list)

- **Local workbenches** — Storybook, Histoire, Ladle, Storybook-for-web-components, Pattern Lab, React Styleguidist, Lost Pixel.
- **Docs platforms** — Docusaurus, Mintlify, Nextra, GitBook, ReadMe, Starlight.
- **Hosted design-system catalogs** — Zeroheight, Supernova, Backlight, Knapsack, Bit.dev.
- **Visual-test / publish** — Chromatic, Percy, Lost Pixel, Applitools.
- **Machine-readable inventory formats** — **Custom Elements Manifest (CEM)**, Storybook CSF3, api-viewer, web-types. *(These are both ingest sources AND a format Web Docs should emit — see epic brainstorm.)*

## Deliverables

- [ ] `src/_data/workbenchTools.json` — one entry per tool: id, name, category axis, model (local/hosted), input format (CSF/MDX/CEM/MDX-docs), notable features, OSS/commercial, URL.
- [ ] `reports/2026-06-…-component-workbench-landscape.md` — the prose landscape + how each maps to the WE constellation (ingest target? feature donor? format to emit?).
- [ ] A `/research/` topic entry so it surfaces on the site (follow the benchmark-corpus precedent).

## Notes

Pure research/authoring — no human fork. Feeds [#625](/backlog/625-inventory-the-full-feature-surface-across-workbench-tools/)
(feature surface) and tells #398's adapter work (#426/#550) **which other adapters** are worth building beyond
Storybook/Mintlify.

## Progress

- **Status:** resolved
- **Branch:** docs/standard-authoring-workflow
- **Done:**
  - `src/_data/workbenchTools.json` — 26 sources across 5 category axes (local-workbench / docs-platform /
    hosted-catalog / visual-test / inventory-format), governed by selectionCriteria + inclusionRule, each with
    model/inputFormat/license/status/weRoles/notableFeatures. Mirrors the benchmarkCorpus.json pattern.
  - `reports/2026-06-14-component-workbench-landscape.md` — the prose landscape + per-axis WE-constellation
    mapping (ingest-target / format-to-emit / feature-donor / benchmark).
  - `/research/` topic `component-workbench-landscape` added to `src/_data/researchTopics.json`.
- **Next:** #625 (feature-surface matrix) is unblocked.
- **Notes:** Two load-bearing priors handed to #626 — (a) **CEM is the format to emit** (web-component-native,
  already tool-consumed; api-viewer is the zero-build proof); (b) the **open-core seam is market-validated**
  (every commercial tier has an OSS/self-hostable counterpart). Currency findings: Backlight RETIRED (shut
  1 Jun 2025), React Styleguidist + Pattern Lab retiring, Histoire pre-v1 one-maintainer, Storybook v9 folded
  test/a11y/visual into core.
