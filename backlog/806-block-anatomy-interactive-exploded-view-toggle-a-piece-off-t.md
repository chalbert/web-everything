---
type: idea
workItem: story
size: 5
status: open
parent: "746"
blockedBy: ["786"]
dateOpened: "2026-06-16"
tags: [webdocs, block-explorer, anatomy, graceful-degradation, plateau-embed]
---

# Block anatomy interactive exploded view + toggle-a-piece-off-to-degrade

The interactive half of the block anatomy view (#748 shipped the static Built-on/Used-by graph in `src/block-pages.njk`). Adds the devtools-style **exploded / layered view** (stack intents → traits → plugs → tokens, hover to highlight each layer's contribution) and the **toggle-a-piece-off-to-degrade** live graceful-degradation demo. Both manipulate the *running* block, which the cross-origin `fuiDemo` iframe forbids — so **blockedBy #786** (mode-C in-document Shadow-DOM render), the only path that mounts a live FUI block in WE's DOM. Includes the conformance-playground fixture (#748 acceptance bullet 4). Share the provider↔consumer graph with #092 / #755, don't duplicate.
