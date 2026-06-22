---
kind: story
size: 2
parent: "1485"
status: resolved
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: "we:blocks/dockable/contract.ts"
tags: []
---

# WE dockable block contract — we:blocks/dockable/contract.ts + contracts re-export + package export

Foundational slice of #1485: author we:blocks/dockable/contract.ts (the recursive node-tree type surface node={type:row|column|stack, children|tabs, size} + orientation/sizing/popout dimensions), the type-only we:contracts/dockable.ts re-export (mirrors we:contracts/stepper.ts), and the ./dockable entry in we:contracts/package.json exports. Bounded, gate-verifiable, no live dep; the FUI impl + #1486 protocol import from here. Deps #1437/#1484 resolved.

## Progress (batch-2026-06-22-1510-1483)

Shipped the contract trio, transcribed from `we:src/_data/intents/dockable.json` (no design fork):

- **`we:blocks/dockable/contract.ts`** — the compile-erased type surface. `DockNode = DockSplitNode | DockStackNode` (the recursive partition tree): `row`/`column` splits carry `children: DockNode[]`, `stack` leaves carry `tabs: DockPanel[]`. `DockSize { unit: 'ratio'|'pixel', value, min?, max? }` encodes the `sizing` dimension + the numeric Window-Splitter constraints; `Popout = 'none'|'window'` on stack/panel; `DockLayout { root, orientation? }` is the serialized artifact = the #1486 Protocol core schema, with an OPEN EXTENSION SLOT (`DockNodeBase.ext`) for the divergent popout-state / per-panel-metadata / constraint encodings (round-trip-preserved opaquely).
- **`we:contracts/dockable.ts`** — type-only `export type *` re-export (mirrors `we:contracts/stepper.ts`/`we:contracts/graph.ts`).
- **`we:contracts/package.json`** — added the `./dockable` subpath export.

`npx tsc --noEmit --strict` on both modules: clean. The split axis IS the node `type` (the `orientation` dimension only seeds/documents the root). FUI's #1511 recursive container render + #1513 serialize/restore import `DockLayout`/`DockNode` from here.
