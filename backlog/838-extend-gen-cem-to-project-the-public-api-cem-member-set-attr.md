---
type: issue
workItem: story
size: 5
status: open
dateOpened: "2026-06-17"
tags: []
---

# Extend gen-cem to project the public-API CEM member set (attributes/properties/slots/cssProperties/cssParts) and wire the props-table page

Per the #801 ratification (Fork-1=B, public-API line): extend scripts/gen-cem.mjs to project attributes, attribute-reflected + deliberately-public properties, slots, cssProperties and cssParts from blocks.json onto the emitted CEM (it currently emits only tagName/events/exports), and wire the per-block page so <props-table tag="…"> resolves real data. Author members with CEM privacy:public; private/internal members are excluded by default (deferred to the #706 opt-in impl-scan). Field shapes mirror CEM 2.1.0 member kinds (no bespoke schema).
