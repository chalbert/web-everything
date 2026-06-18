---
type: issue
workItem: story
size: 5
parent: "904"
status: open
locus: frontierui
dateOpened: "2026-06-18"
tags: []
---

# Build story-canvas FUI block impl

Build story-canvas in `fui:blocks/story-canvas/` (contract: we:src/_data/blocks/story-canvas.json). Render a single WebCase ({id,title,description,code}) in an isolated style/script frame so the demoed component and docs chrome don't leak into each other; interaction-tests fold in as webcases carrying an interaction script. One fixture serves the conformance loop + docs. locus frontierui. Slice of #904 (#626 Fork 2).
