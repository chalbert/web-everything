---
bornAs: xdn96bp
kind: story
size: 3
parent: "2541"
status: open
locus: frontierui
dateOpened: "2026-07-18"
tags:
  - frontier-ui
  - progress
  - implementation
  - console-board
crossRef: { url: /intents/progress/, label: progress intent }
relatedProject: webblocks
scope:
  - frontierui:blocks/progress/
  - frontierui:blocks/__tests__/unit/progress/
  - frontierui:demos/progress-demo.html
  - frontierui:src/_data/blocks.json
---

# Extend the FUI progress block with the secondary/comparison track

The `progress` intent gained an optional `secondaryTrack` dimension ([#2535](/backlog/2535-extend-progress-with-optional-secondary-comparison-track.md), `we:src/_data/intents/progress.json`). Extend the **existing** Frontier UI progress block (#1488) to render it — this is an extension of a shipped block, not a new block.

**Scope:**
- Render `secondaryTrack: comparison` as a second fill on the same track alongside the primary completion fill — the native `<video>` `buffered`-vs-`currentTime` pattern (a lighter secondary fill under the primary), across both `bar` and `circular` presentations.
- Keep `secondaryTrack: none` (default) as the single-fill path, unchanged.

**Boundary:** the second track is **generic completion**. Do NOT bake the app's claimed-vs-verified **provenance** into the block — that is an app binding, never a `progress` term (the #2533 Fork 2 caveat). The block renders two generic completion values; what they *mean* is the consumer's.

**Acceptance:** the FUI progress block renders the `comparison` secondary track (both presentations), `none` unchanged; a demo shows the dual-track fill; render-conformance baseline updated; no re-typing of `progress`/`meter`.
