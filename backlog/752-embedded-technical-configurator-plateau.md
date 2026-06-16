---
type: idea
workItem: story
size: 3
status: open
parent: "746"
locus: webeverything
dateOpened: "2026-06-16"
relatedProject: webdocs
crossRef: { url: /backlog/079-render-strategy-toggle-ui/, label: "Render-strategy toggle (#079)" }
tags: [webdocs, block-explorer, plateau-embed, technical-configurator, render-strategy, chunks, transport]
---

# Embedded technical configurator (Plateau embed) — configure a block's technical aspects, with a cost preview

Add a **"Configure technical aspects"** button on the block page that opens an **embedded mini technical configurator** (a Plateau Technical Configurator embed) scoped to *this block* — render strategy (SSR/CSR/hydration, building on the in-block toggle #079), delivery transport (#455), trait lazy-loading (#448), and chunk splitting (#719/#720). It **deep-links to the full Plateau Technical Configurator** for the project-wide decision. Make the tradeoff visible: show the **resulting chunk graph + an estimated bytes / requests / hydration-cost preview** for the chosen config, so the choice is concrete rather than abstract.

## Build

- "Configure technical aspects" button → embedded mini configurator (Plateau embed) seeded with this block's technical dimensions.
- Surface the dimensions: render strategy (#079), transport (#455), trait lazy-load (#448), chunk split (#719/#720) — cross-ref existing Configurator domains, don't duplicate.
- Cost preview: chunk graph + estimated bytes/requests/hydration for the selected config.
- Deep-link to the full Plateau Technical Configurator for the project-level call.

## Acceptance

- [ ] The button opens the per-block configurator and the deep-link reaches the full Plateau one.
- [ ] Changing a technical setting updates the chunk-graph / cost preview.
- [ ] A fixture exercises at least one non-default technical config on a block.

## Notes

Not hard-blocked — it deep-links to the *existing* Plateau Technical Configurator and the dimensions already have homes (#079/#455/#448/#719). Per intent-UX-only / technical→Configurator: these are technical settings, never UX dimensions on the block and never a WE mandate. Reuse existing Configurator domains (e.g. transport → webrealtime) rather than coining new ones.
