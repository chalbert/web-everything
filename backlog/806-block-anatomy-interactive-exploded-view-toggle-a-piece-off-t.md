---
type: idea
workItem: story
size: 5
status: open
parent: "746"
locus: frontierui
blockedBy: ["809", "815"]
dateOpened: "2026-06-16"
tags: [webdocs, frontierui, block-explorer, anatomy, graceful-degradation, plateau-embed]
---

# Block anatomy interactive exploded view + toggle-a-piece-off-to-degrade

The interactive half of the block anatomy view (#748 shipped the static Built-on/Used-by graph in `src/block-pages.njk`). Adds the devtools-style **exploded / layered view** (stack intents → traits → plugs → tokens, hover to highlight each layer's contribution) and the **toggle-a-piece-off-to-degrade** live graceful-degradation demo. Both manipulate the *running* block. Includes the conformance-playground fixture (#748 acceptance bullet 4). Share the provider↔consumer graph with #092 / #755, don't duplicate.

**Re-homed to FUI-locus (#809).** Per the #809 ruling these manipulations live as chrome inside the FUI-owned workbench (#815, iframe+chrome distribution), where chrome and block are same-origin — host-side intra-FUI, no cross-boundary channel. This supersedes the original "blockedBy #786 / mode-C is the only path" framing: mode C is the *no-chrome* bare-component distribution, not where this interactive view lives. `blockedBy #815`; built `@frontierui`.
