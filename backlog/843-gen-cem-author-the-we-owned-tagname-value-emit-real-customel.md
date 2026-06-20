---
kind: story
size: 2
parent: "746"
status: resolved
blockedBy: ["841"]
relatedProject: webdocs
dateOpened: "2026-06-17"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: scripts/gen-cem.mjs
crossRef: { url: /backlog/822-enrich-block-cem-with-tagname-attributes-properties-slots-so/, label: "CEM surface ruling (#822)" }
tags: [webdocs, cem, blocks, gen-cem, tagname]
---

# gen-cem: author the WE-owned tagName value + emit real customElement declarations (per the ratified naming convention)

The value-bearing half of the #822 build, gated on the naming-convention decision (#841): once WE's tag naming convention is ratified, author the tagName value on each type:Component block (registered via customElements.define) in fui:src/_data/blocks.json and let gen-cem emit customElement:true + tagName declarations — the real custom-element surface the wrapper generator (#821) and api-viewer/Storybook need. Behaviors (attributes.define) stay plain class declarations (no tagName). Blocked by #841 because gen-cem only emits a custom-element declaration when an explicit tagName is present, and the tag value is exactly what #841 decides.

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

## Progress (resolved 2026-06-18)

Implemented sub-shape **(b)** (the marker, per the stated default — a forward-adapter can regenerate the tag):

- **Data** — authored `"element": true` on the 5 single-element opt-in blocks (`autocomplete`,
  `background-task-surface`, `transient-component`, `pagination`, `data-table`) in `src/_data/blocks/*.json`.
  For the multi-element block `router`, authored the explicit N-tag list
  `"tagName": [{tag:"we-route-view",class:"RouteViewElement"},{tag:"we-route-outlet",class:"RouteOutletElement"}]`
  (the documented exception — not derivable from one id). Element-ness is opt-in, **not** derived from `type`
  (the 6 straddle `Component` + `Module`).
- **gen-cem** — added `TAG_PREFIX = 'we-'` (Config-Extends-Platform-Default; consumer override = #844) and an
  `elementTags(b, declName)` normalizer: `element:true` → `we-<id>`; `tagName` string → explicit; `tagName`
  list → N `{tag,class}` pairs. `cemModule` emits the primary custom-element declaration (carrying the full
  projected member surface) plus one extra bare custom-element declaration per additional tag.
- **Result** — `we:custom-elements.json` now carries **7** real `customElement:true` declarations
  (`we-autocomplete`, `we-background-task-surface`, `we-data-table`, `we-pagination`, `we-route-view`,
  `we-route-outlet`, `we-transient-component`) — the surface `gen:wrapper` (#821) and api-viewer/Storybook
  need. Behaviors (`attributes.define`) stay plain class declarations (no tagName). 503 scripts tests green,
  `check:standards` green except the pre-existing concurrent we:AGENTS.md-inventory error (not from this change).
  Unblocks #839 (qualifying set = these tagged blocks) and the #753/#892 wrapper line.
