---
kind: epic
size: 13
status: open
blockedBy: ["1381"]
dateOpened: "2026-06-21"
locus: frontierui
relatedProject: webcomponents
tags: [packaging, custom-elements, block-model, conversion, frontierui]
---

# Block-model conversion: register remaining blocks as custom elements (per-block mechanism)

Separately-prioritized build epic spun out of #1381. End-state already ruled by #1321: every block becomes a custom element, mechanism chosen per use case. Today only ~7 of 75 blocks register a tag (we:backlog/1321:120-124). Convert the rest, applying the #1381 mechanism-selection guideline (codified we:docs/agent/block-standard.md packaging governance): default S1/native-first; behavior-free presentational control (button, badge) -> transient (A); framework-bound/reactive block -> persistent light-DOM (B); block facing hostile/unknown host CSS opting into #1349 S2 -> shadow (C). Sequenced by normal burndown ordering; per-block slices filed as picked up.
