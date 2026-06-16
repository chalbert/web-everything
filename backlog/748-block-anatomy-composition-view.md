---
type: idea
workItem: story
size: 5
status: resolved
parent: "746"
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: src/block-pages.njk
relatedProject: webdocs
crossRef: { url: /backlog/727-web-docs-blocks-per-component-live-surface-fui-render-props-/, label: "Per-component surface (#727)" }
tags: [webdocs, block-explorer, anatomy, traits, plugs, intents, provider-graph, browse]
---

# Block anatomy / composition view — see and browse every piece a block is made of

Give each block page an **anatomy panel** that lists every piece the block is composed of — traits, plugs, intents, tokens, and the providers it consumes — with each item a link to its own detail page so they're independently browsable. Add an **exploded / layered view** (devtools-style) that stacks the contributing layers (intents → traits → plugs → tokens) and highlights each layer's markup/token contribution on hover. Crucially, let the viewer **toggle each piece on/off** to watch the block gracefully degrade — a live demonstration of the minimize-lock-in / graceful-degradation principle, not just a static manifest.

## Build

- Anatomy panel on the block page: enumerate the block's traits/plugs/intents/tokens/providers from the existing registries (intents.json, plugs, CEM manifest from #626) — each row cross-links to its catalog detail page.
- Exploded layer view: visual stack of the composition layers; hover a layer → highlight its contribution in the rendered block.
- "Used-by" backlinks: from a trait/plug detail page, list every block that composes it (bidirectional graph).
- Toggle-to-degrade: turn a trait/plug off in the live render and show the degraded result.

## Acceptance

- [ ] A block page shows its full piece list, every piece linking to a browsable detail page.
- [ ] The exploded view maps each layer to its rendered contribution.
- [ ] Disabling a piece live shows graceful degradation.
- [ ] A fixture/case exercises the anatomy view in the conformance playground.

## Notes

Static listing can be built off the registries without the live render, so this is not hard-blocked on #727; the toggle-to-degrade and hover-highlight features layer on once #727's live render lands. Provider↔consumer edges overlap with #092 / inspection devtools (#755) — share the graph data, don't duplicate it.

## Progress (resolved 2026-06-16) — static composition graph shipped; interactive half carved to #806
Delivered the **registry-driven, buildable-now half**: an **Anatomy** `section-card` on [`src/block-pages.njk`](../src/block-pages.njk) rendering the block's composition graph straight from `blocks.json` —
- **Built on:** `block.dependsOn` (a clean block→block graph; 17/18 values are block ids), each linking to `/blocks/{id}/`; the one capability dep (`error-recovery`) renders as a labelled non-link.
- **Used by:** the reverse edge — every block whose `dependsOn` names this one — computed inline over the `blocks` collection, each cross-linked. Verified bidirectional (wizard *Built on* → stepper/workflow-engine; stepper *Used by* → wizard).
- Sits alongside the existing **Implements / Composes Intents** and **Traits** sections (already cross-linked from #627/#727) to form the full browsable piece list. 11ty builds clean; gate green.

**Carved out — interactive half → [#806](/backlog/806-block-anatomy-interactive-exploded-view-toggle-a-piece-off-t/) (blockedBy #786):** the exploded/hover-highlight view and the toggle-a-piece-off-to-degrade live demo both need to manipulate the *running* block in the page, which the cross-origin `fuiDemo` iframe forbids — only mode-C in-document render (#786) makes it possible. The conformance-playground fixture (acceptance bullet 4) goes with that interactive slice.
