---
kind: story
size: 5
parent: "2093"
status: resolved
dateOpened: "2026-07-02"
dateStarted: "2026-07-02"
dateResolved: "2026-07-02"
tags: []
---

# Mint CustomNode base + customNodes registry, migrate value:'shown' interpolation as first consumer

Mint the CustomNode base + customNodes registry (fui:plugs/webnodes/ over fui:plugs/core/HTMLRegistry.ts) with the #2074 define()-time conformance errors (AmbiguousPayloadError, MissingRegionCloseError, DelimiterCollisionError + the two warn cases), and migrate the value:'shown' interpolation path onto it as the first consumer — parser open/close from statics (fui:plugs/webexpressions/CustomTextNodeParser.ts:34-121), the CustomTextNodeRegistry walk as the Text-host materializer, bootstrap re-key at fui:plugs/bootstrapUnplugged.ts:156-165. Demoable: {{ price }} renders via customNodes.define.
