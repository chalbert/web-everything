---
kind: decision
status: open
scope: ["we:scripts/operations/deliver-item-wrapper.mjs"]
dateOpened: "2026-09-27"
tags: []
---

# Design multi-repo couple locus delivery (e.g. we+plateau-app #2662) for the mechanical build wrapper

build-path-codex-isolation-locus fixed the single non-we locus case (a card scoped to exactly one of frontierui/plateau-app now gets its own implementation lane, acquired via acquireImplLane). A card whose scope spans TWO OR MORE repos (we+plateau-app, or frontierui+plateau-app together) is refused instead with a clear error (resolveDeliveryLocus's multiRepo case), deferred here: needs a ruling on merge order (impl-first vs WE-last, per the operator's own #2748 drain convention), whether one PR or two, which repo's gate governs, and how the agent writes to two lanes in one turn given Codex's OS sandbox (:workspace) is confined to a single spawn cwd. Live trial set (#3604 fix) named #2662 (we+plateau-app) as this shape's own example.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
