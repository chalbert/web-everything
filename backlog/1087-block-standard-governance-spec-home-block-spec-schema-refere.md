---
kind: story
size: 5
parent: "1040"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:docs/agent/block-standard.md"
tags: []
---

# Block standard governance spec home + block-spec schema reference

Establish the block-standard governance doc home (expand `we:src/_includes/project-webblocks.njk` + a `we:docs/agent/block-standard.md` authoring guide) documenting the full block-spec JSON schema — every declarable field (id/name/status/type/exports/attributes/properties/events/slots/cssParts/traits/composes*/dependsOn/intentDimensions/…) and its meaning. The 'type system' area of #1040 and the foundational home the per-area governance sections (lifecycle #1092 / taxonomy #1093 / composability #1094) hang off. Grounding: `we:src/_data/blocks/*.json` schema, `we:scripts/check-standards.mjs:136-148`.

## Progress

Established the block-standard governance home (the type-system / schema area of epic #1040):
- New `we:docs/agent/block-standard.md` — the full block-spec schema reference: every declarable field
  documented (identity & lifecycle; contract surface exports/implementedBy/extendsClass; CEM surface
  attributes/properties/events/slots/cssParts; composition implementsIntent/composesIntents/
  intentDimensions/dependsOn/traits; narrative & cross-ref), each with R-required marking + shape +
  meaning, derived from the real `we:src/_data/blocks/*.json` field union + the `BLOCK_TYPES`/`LIFECYCLE`
  enums. Plus an authoring guide (scaffold → describe → declare-contract-not-impl → wire-composition →
  graduate-by-lifecycle) and the validation rules `we:scripts/check-standards.mjs` enforces.
- Governance section added to `we:src/_includes/project-webblocks.njk` linking the schema home + the
  three per-area sections (lifecycle #1092 / taxonomy #1093 / composability #1094) that hang off it.

Scope is the schema/home only — the per-area governance prose is the separately-sliced #1092/#1093/#1094.
