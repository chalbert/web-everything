---
kind: story
size: 3
status: resolved
blockedBy: ["1437"]
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "we:src/_data/intents/dockable.json"
tags: []
---

# Mint the dockable intent (composing resizable + tabs + reorder substrate)

Realizing build of #1437 Fork 1a: author the dockable intent as a WE standard artifact (we:src/_data/intents/dockable.json) — the recursive-container model (node = row|column|stack, space fully partitioned, no gaps/overlaps) + drag-to-dock re-tiling semantics + the composed a11y contract (APG Window Splitter on splits, APG Tabs on stacks). Composes the shipped resizable splitter, the tabs block, and reorder's grab/move/drop + live-region + moveBefore substrate ratified by #1384. Adds no new gesture. Dimensions: orientation/sizing + the popout dimension (Fork 3a, default none minimal-core).

## Progress (batch-2026-06-21-1429-1487)

Authored the intent (modelled on `we:src/_data/intents/resizable.json`):
- **`we:src/_data/intents/dockable.json`** (new) — `status: concept`, standalone intent composing
  `resizable` + tabs + reorder. Summary + HTML description carry the recursive-container model
  (node = row|column|stack, fully partitioned), the distinct-from-arrangeable rationale (recursive tree
  vs flat `Array<{x,y,w,h}>`), the composed a11y invariants (APG Window Splitter on splits + APG Tabs on
  stacks, both fixed — not dimensions), and the note that the serialized layout tree is a separate
  first-class Protocol (#1437 Fork 2a, materializing with the realizing build, not here).
- **Dimensions**: `orientation` (row default / column — seeds root split axis), `sizing` (ratio default
  / pixel — per-node min/max are numeric binding props, not enum values), `popout` (`none` default —
  **minimal-core** per #1437 Fork 3a, NOT most-permissive — / `window`, deferred to the build).
- **`we:src/_data/semantics/dockable.json`** (new) — glossary term (#1327 coverage).

Gate green (0 errors). No gesture added; no impl/protocol minted here (both follow per #1437). Sibling
realizing items (composing block, the `dockable-layout` protocol) are separately scheduled under #1437.
