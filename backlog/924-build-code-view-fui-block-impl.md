---
type: issue
workItem: story
size: 5
parent: "904"
status: open
locus: frontierui
blockedBy: ["916"]
dateOpened: "2026-06-18"
tags: []
---

# Build code-view FUI block impl

Build code-view in `fui:blocks/code-view/` (contract: we:src/_data/blocks/code-view.json). Syntax-highlighted component source with a copy affordance; native-first highlighting paints token ranges via the CSS Custom Highlight API over a tokenizer (no per-token `<span>`), with library highlighters (Prism/Shiki/hljs) as opt-in adapters. Copy affordance composes data-transfer's copy-out half → blockedBy #916. Live-editable sandbox out of scope. locus frontierui. Slice of #904 (#626).
