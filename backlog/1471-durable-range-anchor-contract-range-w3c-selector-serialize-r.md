---
kind: story
size: 8
status: open
dateOpened: "2026-06-21"
tags: []
---

# durable-range-anchor contract — Range↔W3C-selector serialize, re-resolve (fuzzy+orphan), anchorStrategy dimension

Foundational contract ratified by #1408 (Fork 2 split). Author the target-agnostic durable-range-anchor standard: capture a Range, serialize to a W3C selector bundle (TextQuote/TextPosition/Range), re-resolve later with fuzzy fallback + first-class orphan state. Homes Fork 3's anchorStrategy (quote|position|bundle, default bundle) as ITS dimension. Adopts the W3C selector vocabulary wholesale at the wire layer; its we:contract.ts is the foundational slice the annotation intent imports. Reusable beyond annotation (deep-linking, citations, #:~:text=-style scroll-to-text, durable test selectors). File via /new-standard. Per #1408 codifiedIn intents-ux-only corollary.
