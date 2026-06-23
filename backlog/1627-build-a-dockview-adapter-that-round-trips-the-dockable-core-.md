---
kind: task
status: resolved
dateOpened: "2026-06-23"
dateStarted: "2026-06-23"
dateResolved: "2026-06-23"
graduatedTo: blocks/adapters/dockview/dockviewLayout.ts
relatedProject: webadapters
tags: []
---

# Build a dockview adapter that round-trips the dockable core schema (clears #1486 mint gate)

Build a second-family adapter (dockview) that ingests dockview's native serialized layout (api.toJSON/fromJSON) into the WE dockable core schema {type: row|column|stack, children|tabs, size} and emits it back, proving a lossless round-trip against we:blocks/dockable/contract.ts. This is the independent 2nd conforming impl the #project-protocol-bar rule requires before the dockable Protocol can be minted (#1486). dockview is the cleanest target (explicit JSON tree, framework-agnostic, matches FUI's vanilla grain). Divergent dockview-specific encodings (popout state, per-panel metadata, constraints) round-trip through the extension slot, not the core. Survey + convergence evidence: we:reports/2026-06-21-docking-tiling-partition-tree.md.

**Done when:** a dockview layout serializes → WE core schema → reconstructs an equivalent dockview layout, with a conformance test asserting the core round-trip is lossless (divergent bits preserved via the extension slot). FUI's existing dockable render (#1511–#1514) is conforming impl family #1; this is the independent family #2.

**Un-blocks:** #1486 (mint the dockable Protocol) — once this round-trip passes, the `#project-protocol-bar` gate clears and the Protocol entry can be authored.

## Progress

Built `we:blocks/adapters/dockview/dockviewLayout.ts` — pure `fromDockview`/`toDockview` (no `dockview`
runtime dep; the serialized JSON shape is the contract, mirroring the report adapters). dockview's gridview
branch/leaf tree maps onto the contract's explicit `row`/`column`/`stack` partition tree, materializing the
depth-parity orientation alternation in/out. Divergent dockview encodings (the global `panels` map's
`contentComponent`/`params`/constraints, `activeGroup`, floating/popout groups, canvas `width`/`height`)
round-trip **opaquely through the `DockNodeBase.ext` slot** — per-panel residue on each stack's
`ext.dockview`, canvas-global residue on the root's `ext.dockviewRoot`; the core never reads `ext`.
Conformance test `we:blocks/__tests__/unit/adapters/dockviewRoundtrip.test.ts` (4 cases) asserts: lossless
`dockview → core → dockview` identity; correct core topology incl. orientation alternation; the core carries
**none** of the divergent encoding (only id+title on panels); and a hand-authored ext-less core still emits a
valid dockview layout via defaults (proving a real generator, not a replay). This is conforming impl **family
#2** — clears the `#project-protocol-bar` gate on #1486.
