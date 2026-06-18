---
type: idea
workItem: epic
status: resolved
dateOpened: "2026-06-14"
dateResolved: "2026-06-17"
graduatedTo: none
relatedProject: webdocs
crossRef: { url: /backlog/398-build-the-web-docs-product-fui-open-primitives-plateau-app-o/, label: "Sibling — Web Docs served product (#398)" }
tags: [webdocs, storybook, inventory, component-catalog, intents, blocks, discovery, pipeline]
---

# Web Docs feature pipeline — inventory workbench tools, derive intents/blocks, build the docs surface

Discovery→standards **feeder** for the Web Docs product. Today the constellation has the *product/monetization*
half (**[#398](/backlog/398-build-the-web-docs-product-fui-open-primitives-plateau-app-o/)** served site + open-core;
**[#604](/backlog/604-migrate-the-we-site-to-render-real-frontier-ui-blocks-replac/)** render real FUI blocks;
**[#426](/backlog/426-incumbent-ingestion-adapters-storybook-mintlify-to-the-webca/)**/#550 ingestion adapters) but
**no documented answer to "what is a component-workbench actually made of, expressed as WE standards?"** Storybook
and Mintlify were named as ingest targets, but the *landscape* and the *feature surface* were never enumerated, so
the intents/blocks needed for a WE-native docs surface are unknown. This epic supplies that pipeline.

## The pipeline (sequential chain)

| # | Item | Output | Blocked by |
|---|---|---|---|
| 1 | **[#624](/backlog/624-inventory-the-component-workbench-docs-tool-landscape-storyb/)** — inventory the tool landscape | `reports/` landscape + `we:src/_data/workbenchTools.json` registry | — |
| 2 | **[#625](/backlog/625-inventory-the-full-feature-surface-across-workbench-tools/)** — inventory the full feature surface | cross-tabbed feature matrix (tool × capability) | #624 |
| 3 | **[#626](/backlog/626-map-workbench-features-to-we-standards-which-intents-blocks-/)** — map features → WE standards (decision) | build plan: which intents/blocks/adapters to mint vs reuse | #625 |
| 4 | **[#627](/backlog/627-assemble-the-web-docs-component-catalog-surface-from-the-der/)** — assemble the docs/catalog surface | the navigable Storybook-equivalent surface | #626 |

Stage 4 **converges with** #604 + #398 — it does not fork a parallel build. The minimal first slice is a `/blocks/`
index page (the missing "browse all components" surface).

## Why a feeder epic and not folded into #398

#398 is *product/monetization* (open-core served site, per-customer conformance). This epic is *standards discovery*
— it tells #398 and #604 **what to render**. Keeping them apart respects bias-toward-separation: one decides what the
docs surface is *made of* (WE intents/blocks), the other packages and serves it. #398's ingestion adapters (#426/#550)
covered only Storybook + Mintlify; #624's landscape says **which other adapters** are worth building.

## Boundary (what this epic does NOT own)

- The served product, hosting, open-core tiering → #398 / #428.
- The live block-render pipeline (plugs bootstrap, real FUI blocks) → #604.
- Building each *minted* intent/block → spun off as separate batchable items once #626 names them.

## Acceptance (epic done when)

- [x] #624 — workbench landscape published as a registry + report.
- [x] #625 — feature matrix covers every tool in the registry.
- [x] #626 — every feature classified mint-new vs reuse-existing, with the build plan filed.
- [x] #627 — a navigable catalog surface exists, starting with `/blocks/`, converged with #604/#398.
