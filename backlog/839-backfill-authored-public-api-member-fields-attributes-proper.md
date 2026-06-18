---
type: issue
workItem: story
size: 8
status: resolved
blockedBy: ["838", "841", "843"]
dateOpened: "2026-06-17"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: src/_data/blocks/router.json
tags: []
---

# Backfill authored public-API member fields (attributes/properties/slots/cssProperties/cssParts) across blocks.json

Per the #801 ratification: backfill the public-API contract surface onto blocks.json for blocks that have a /blocks/ page + a registered tag first — attributes, reflected + deliberately-public properties (CEM privacy:public), slots, cssProperties, cssParts. Completeness-gated the way #706's invariant gates the FUI catalog. Blocked by #838 (the gen-cem projection + props-table wiring must land first so authored fields render).

**Also blockedBy #841 (added 2026-06-17, batch pre-flight).** The selection criterion is "blocks that have a /blocks/ page **+ a registered tag** first", but no `blocks.json` entry carries a `tagName` and #822's ruling explicitly gates tagName authoring (a real `customElement` declaration "lands only once that names ruling exists") on the [#841](/backlog/841-decide-the-we-contract-custom-element-tag-naming-convention/) tag-naming-convention decision, which is still open (Tier-B, prepared not ratified). Until #841 ratifies and tags are authored, the *qualifying set* (and therefore the completeness gate #840 enforces) is undefined — so the broad backfill can't be scoped honestly. The structural-surface authoring (#842 did 9 from each block's WE contract, value-agnostic) is the unblocked half; this item is the tag-scoped broad tranche and waits on #841.

## Progress (resolved 2026-06-18)

#841 + #843 landed (tags authored), so the **qualifying set is now defined**: the blocks carrying a registered
tag (#843's `element:true` / `tagName`) **and** a `/blocks/` page = **6 blocks** — `autocomplete`,
`background-task-surface`, `data-table`, `pagination`, `router`, `transient-component` (all six tagged blocks
happen to have a page). Backfilled their authored public-API member fields onto `src/_data/blocks/*.json`,
**sourced strictly from each block's own WE contract** (the `block-descriptions/*.njk` spec + the JSON
surface — one extraction pass per block, no invention):

- **autocomplete** — 5 attributes + 2 properties (incl. the rich `selectedOption`).
- **pagination** — 6 attributes + 8 properties (the `pageMode × advance` axes, URL-sync, range label).
- **data-table** — 1 attribute (`sort:header` behavior seam).
- **transient-component** — 2 attributes (`level` on `<auto-heading>`, `href` on `<smart-link>`) + 1 property
  + the default slot (move-not-clone).
- **background-task-surface** — 3 attributes + 5 properties (aggregation/persistence/navigation-guard…);
  `events` were already authored.
- **router** — 14 attributes (across `<we-route-view>`/`<we-route-outlet>`/`route:*` template + link/prefetch
  behaviors) + 8 properties.

`gen:cem` reprojects them (e.g. `we-autocomplete` → 5 attributes + 2 members); `cssProperties`/`cssParts` were
not documented on these contracts (left absent, not fabricated). 503 scripts tests + `check:standards` green.
The completeness gate (#840) and the deeper per-member impl-conformance remain its own items; this is the
tag-scoped authoring tranche #801 called for.
