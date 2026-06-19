---
type: idea
workItem: story
size: 3
parent: "1018"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:positioning/contract.ts"
tags: []
---

# webpositioning contract — anchor-positioning types in @webeverything

Slice A of webpositioning impl epic #1018. Define the WE-side anchor-positioning contract (positioning strategy + responsive-placement types) in @webeverything, mirroring the resolved [the Project/Protocol bar](docs/agent/platform-decisions.md#project-protocol-bar)/#508 design and the shape already proven by FUI's fui:blocks/droplist/positioning/ runtime. Type-only crosses the seam (npm scope mirrors layer). Foundation slice — B and C build on it.

## Progress

Shipped `we:positioning/contract.ts` — the pure-contract half (compile-erased, the future
`@webeverything/contracts/positioning` entry): `Placement` (12-value union, tightening FUI's loose
`string`), `PlacementContext` (declarative intent), `PositioningTeardown`, `PositioningStrategy` (the
swappable provider seam). Mirrors `fui:blocks/droplist/positioning/types.ts`; the runtime strategies +
`position-area` CSS map + `customPositioning` registry stay impl (→ FUI). Slices B/C build on this.
