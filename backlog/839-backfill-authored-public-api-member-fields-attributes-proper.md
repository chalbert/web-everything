---
type: issue
workItem: story
size: 8
status: open
blockedBy: ["838", "841"]
dateOpened: "2026-06-17"
dateStarted: "2026-06-17"
tags: []
---

# Backfill authored public-API member fields (attributes/properties/slots/cssProperties/cssParts) across blocks.json

Per the #801 ratification: backfill the public-API contract surface onto blocks.json for blocks that have a /blocks/ page + a registered tag first — attributes, reflected + deliberately-public properties (CEM privacy:public), slots, cssProperties, cssParts. Completeness-gated the way #706's invariant gates the FUI catalog. Blocked by #838 (the gen-cem projection + props-table wiring must land first so authored fields render).

**Also blockedBy #841 (added 2026-06-17, batch pre-flight).** The selection criterion is "blocks that have a /blocks/ page **+ a registered tag** first", but no `blocks.json` entry carries a `tagName` and #822's ruling explicitly gates tagName authoring (a real `customElement` declaration "lands only once that names ruling exists") on the [#841](/backlog/841-decide-the-we-contract-custom-element-tag-naming-convention/) tag-naming-convention decision, which is still open (Tier-B, prepared not ratified). Until #841 ratifies and tags are authored, the *qualifying set* (and therefore the completeness gate #840 enforces) is undefined — so the broad backfill can't be scoped honestly. The structural-surface authoring (#842 did 9 from each block's WE contract, value-agnostic) is the unblocked half; this item is the tag-scoped broad tranche and waits on #841.
