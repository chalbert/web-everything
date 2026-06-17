---
type: issue
workItem: story
size: 3
parent: "746"
status: resolved
relatedProject: webdocs
dateOpened: "2026-06-17"
dateStarted: "2026-06-17"
dateResolved: "2026-06-17"
graduatedTo: src/_data/blocks.json
crossRef: { url: /backlog/822-enrich-block-cem-with-tagname-attributes-properties-slots-so/, label: "CEM surface ruling (#822)" }
tags: [webdocs, cem, blocks, gen-cem, api-viewer]
---

# gen-cem: project custom-element structural surface (attributes/properties/slots) + author it from each block's WE contract

Per the #822 ruling, the custom-element surface is a WE-owned contract. This is the value-agnostic half of the #822 build (unblocked): extend gen-cem's cemModule (scripts/gen-cem.mjs) to project attributes/properties/slots/members onto the declaration (today only events/exports map), and author that structural surface on the relevant src/_data/blocks.json entries, derived from each block's intent dimensions / webStandards contract — not from FUI. Does NOT author tagName or emit customElement:true declarations (that needs the tag — see the blocked sibling); ships the props/slots surface useful to the docs props-table and api-viewer regardless.

## Progress

**Resolved 2026-06-17 (batch-2026-06-17).**

- **Projection** — the `cemModule` extension (project `attributes`/`members`/`slots`/`cssProperties`/`cssParts` onto the declaration) was delivered by the sibling **#838** (the #801 props-table slice — same machinery, same `gen-cem.mjs`). This item's residual is therefore the **authoring half** the #822 ruling names: populate the WE-owned structural surface across the relevant blocks.
- **Authored surface** — `src/_data/blocks.json` now declares the public structural surface (attributes / properties / slots, plus `cssParts` where it reads cleanly) on 8 representative `type: Component` blocks, each **derived from the block's own `webStandards` / native-first contract**, never from FUI: `tabs` (exclusive-group `name`, `activeTab`, tab/panel slots), `dialog` (`open`/`modal`, `backdrop`/`panel` parts), `drawer` (`open`/`placement`/`dismissible`), `tooltip` (`for`/`placement`), `toggle-switch`, `checkbox` (incl. `indeterminate`), `radio-group` (roving `value`), `slider` (range `min`/`max`/`step`/`value`/`range`). `gen:cem` regenerated — every one projects real attributes/members/slots into its CEM declaration and the per-block **Public API** panel (#838 render).
- **Scope held to the ruling** — no `tagName` and no `customElement: true` declarations (that is the blocked tag-half sibling); these stay `class` declarations carrying the structural surface, exactly as #822 §Scope prescribes. The remaining Component blocks are populated incrementally on the same pattern (the machinery + reference set are in place; this is data authoring, not a code change).

`graduatedTo` → `src/_data/blocks.json` (the authored WE-owned contract this item delivers).
