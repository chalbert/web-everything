---
kind: story
size: 2
parent: "728"
status: parked
parkedReason: deferred
parkedDate: "2026-06-22"
locus: frontierui
dateOpened: "2026-06-16"
tags: []
---

# B2 native host-backdrop overlay mode for the FUI embed SDK

Add the B2 render mode to the FUI-owned embed SDK: the demo posts overlay intent + geometry and the SDK paints its own native `<dialog>`/popover backdrop in the host document, positions the frame, and hands off the focus trap — the most native-feeling host-covering overlay. Ruled a coherent end-state by #732 (the embed-overlay-escape dimension — the [we-fui-embed-boundary](docs/agent/platform-decisions.md#we-fui-embed-boundary) rule) but deferred-on-priority behind B1 (the cheaper promote-frame mode #728 carves first). The overlay enum flag already reserves its slot (overlay="backdrop"), so landing it is additive, not a breaking change. Pursue when a demo needs the host's own chrome around the overlay.

## Parked 2026-06-22 (batch pre-flight) — deferred-on-priority, additive

B1 (the cheaper promote-frame mode) is **built** (embed SDK skeleton #807, B1 overlay-escape #808, the #732
boundary all resolved), so this is no longer dependency-blocked — it is explicitly **deferred-on-priority**
behind B1 and additive (the `overlay="backdrop"` enum slot is already reserved). Parked `deferred`. **Trigger
to un-park:** a demo that needs the host's own native chrome (`<dialog>`/popover backdrop) around the overlay.
Locus is `frontierui` (the embed SDK lives in `../frontierui/embed/`).
