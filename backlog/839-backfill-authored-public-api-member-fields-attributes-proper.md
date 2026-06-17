---
type: issue
workItem: story
size: 8
status: open
blockedBy: ["838"]
dateOpened: "2026-06-17"
tags: []
---

# Backfill authored public-API member fields (attributes/properties/slots/cssProperties/cssParts) across blocks.json

Per the #801 ratification: backfill the public-API contract surface onto blocks.json for blocks that have a /blocks/ page + a registered tag first — attributes, reflected + deliberately-public properties (CEM privacy:public), slots, cssProperties, cssParts. Completeness-gated the way #706's invariant gates the FUI catalog. Blocked by #838 (the gen-cem projection + props-table wiring must land first so authored fields render).
