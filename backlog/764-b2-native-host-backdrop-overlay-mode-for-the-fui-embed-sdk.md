---
type: issue
workItem: story
size: 2
parent: "728"
status: open
blockedBy: ["728"]
dateOpened: "2026-06-16"
tags: []
---

# B2 native host-backdrop overlay mode for the FUI embed SDK

Add the B2 render mode to the FUI-owned embed SDK: the demo posts overlay intent + geometry and the SDK paints its own native `<dialog>`/popover backdrop in the host document, positions the frame, and hands off the focus trap — the most native-feeling host-covering overlay. Ruled a coherent end-state by #732 (the embed-overlay-escape dimension) but deferred-on-priority behind B1 (the cheaper promote-frame mode #728 carves first). The overlay enum flag already reserves its slot (overlay="backdrop"), so landing it is additive, not a breaking change. Pursue when a demo needs the host's own chrome around the overlay.
