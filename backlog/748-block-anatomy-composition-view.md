---
type: idea
workItem: story
size: 5
status: open
parent: "746"
dateOpened: "2026-06-16"
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
