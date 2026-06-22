---
kind: story
size: 2
parent: "728"
status: resolved
locus: frontierui
dateOpened: "2026-06-16"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: embed/contract.ts host-backdrop (B2) mode
tags: []
---

# B2 native host-backdrop overlay mode for the FUI embed SDK

Add the B2 render mode to the FUI-owned embed SDK: the demo posts overlay intent + geometry and the SDK paints its own native `<dialog>`/popover backdrop in the host document, positions the frame, and hands off the focus trap — the most native-feeling host-covering overlay. Ruled a coherent end-state by #732 (the embed-overlay-escape dimension — the [we-fui-embed-boundary](docs/agent/platform-decisions.md#we-fui-embed-boundary) rule) but deferred-on-priority behind B1 (the cheaper promote-frame mode #728 carves first). The overlay enum flag already reserves its slot (overlay="backdrop"), so landing it is additive, not a breaking change. Pursue when a demo needs the host's own chrome around the overlay.

## Open — additive, low-priority (soft "deferred" park retired 2026-06-22)

B1 (the cheaper promote-frame mode) is **built** (embed SDK skeleton #807, B1 overlay-escape #808, the #732
boundary all resolved), so this is no longer dependency-blocked and is additive (the `overlay="backdrop"`
enum slot is already reserved) — i.e. an agent-doable ready story, just low-leverage until a demo needs the
host's own native chrome (`<dialog>`/popover backdrop) around the overlay. Held `open` and left to rank by
leverage rather than parked: the soft "deferred-on-priority" hold is no longer a valid state (#1392-tightened
gate — parking is not a prioritisation escape; it needs a real structural reason this item doesn't have).
Locus is `frontierui` (the embed SDK lives in `../frontierui/embed/`).
