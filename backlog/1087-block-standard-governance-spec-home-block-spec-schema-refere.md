---
type: idea
workItem: story
size: 5
parent: "1040"
status: open
dateOpened: "2026-06-19"
tags: []
---

# Block standard governance spec home + block-spec schema reference

Establish the block-standard governance doc home (expand `we:src/_includes/project-webblocks.njk` + a `we:docs/agent/block-standard.md` authoring guide) documenting the full block-spec JSON schema — every declarable field (id/name/status/type/exports/attributes/properties/events/slots/cssParts/traits/composes*/dependsOn/intentDimensions/…) and its meaning. The 'type system' area of #1040 and the foundational home the per-area governance sections (lifecycle #1092 / taxonomy #1093 / composability #1094) hang off. Grounding: `we:src/_data/blocks/*.json` schema, `we:scripts/check-standards.mjs:136-148`.
