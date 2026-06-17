---
type: issue
workItem: story
size: 2
parent: "746"
status: open
blockedBy: ["841"]
relatedProject: webdocs
dateOpened: "2026-06-17"
crossRef: { url: /backlog/822-enrich-block-cem-with-tagname-attributes-properties-slots-so/, label: "CEM surface ruling (#822)" }
tags: [webdocs, cem, blocks, gen-cem, tagname]
---

# gen-cem: author the WE-owned tagName value + emit real customElement declarations (per the ratified naming convention)

The value-bearing half of the #822 build, gated on the naming-convention decision (#841): once WE's tag naming convention is ratified, author the tagName value on each type:Component block (registered via customElements.define) in src/_data/blocks.json and let gen-cem emit customElement:true + tagName declarations — the real custom-element surface the wrapper generator (#821) and api-viewer/Storybook need. Behaviors (attributes.define) stay plain class declarations (no tagName). Blocked by #841 because gen-cem only emits a custom-element declaration when an explicit tagName is present, and the tag value is exactly what #841 decides.

## Per #841 ratification (2026-06-17)

#841 ratified the value policy this build implements. Carry these in:

- **Element-ness is opt-in and orthogonal to `type` — NOT "each `type:Component` block."** Only the ~7 blocks
  that genuinely register a custom element get a `tagName`, and they straddle `type:Component` (`autocomplete`,
  `router`, `background-task-surface`) **and** `type:Module` (`transient-component`, `pagination`,
  `data-table`). Author `tagName` only on opt-in elements; never derive element-ness from `type`. (The lead
  paragraph's "each type:Component block" is superseded by this.)
- **Value = derivable `<prefix>-<id>`, prefix default `we-`** (configurable Config-Extends-Platform-Default).
- **(a)/(b) authoring sub-shape — decide in this build:** (a) author the full literal `"tagName":
  "we-autocomplete"` (convention enforced by a `check:standards` lint), or (b) author a marker
  (`"element": true`) and have `gen-cem` *compute* `<prefix>-<id>`. **2A's derivability favors (b)** (a
  forward-adapter can regenerate the tag); pick at build.
- **Multi-tag data model:** widen `tagName` from scalar to a list / N element declarations so `router` →
  `route-view` + `route-outlet` (`cemModule` currently emits one declaration off a scalar `b.tagName`).
- **Override lives consumer-side, not in the WE value** — see #844 (parameterized registration). WE authors
  only the derived default (+ the N-tag list for `router`); pretty legacy names (`page-nav`, `auto-heading`)
  are consumer overrides, not WE-contract values.
