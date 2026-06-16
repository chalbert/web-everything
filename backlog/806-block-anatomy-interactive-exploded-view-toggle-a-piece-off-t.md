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

The interactive half of the block anatomy view. #748 shipped the static composition graph — the registry-driven Built-on / Used-by dependency edges + cross-links in `src/block-pages.njk`. This adds the devtools-style **exploded / layered view** (stack intents → traits → plugs → tokens, hover a layer to highlight its rendered contribution) and the **toggle-a-piece-off-to-watch-it-degrade** live demonstration of the minimize-lock-in / graceful-degradation principle. Both require manipulating the *running* block in the page, which the cross-origin `fuiDemo` iframe boundary forbids — so this is **blockedBy #786** (mode-C in-document Shadow-DOM render), the only path that mounts a live FUI block in WE's own DOM to toggle. Also wire the conformance-playground fixture exercising the anatomy view (#748 acceptance bullet 4). Share the provider↔consumer graph data with #092 / inspection devtools (#755) rather than duplicating it.
