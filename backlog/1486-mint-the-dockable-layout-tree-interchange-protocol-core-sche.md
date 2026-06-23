---
kind: task
status: open
dateOpened: "2026-06-21"
blockedBy: [1653]
dateStarted: "2026-06-23"
tags: []
---

# Mint the dockable layout-tree interchange Protocol (core schema + extension slot)

Realizing build of [#1437](/backlog/1437-decision-docking-tiling-dockable-window-management-placement-/)
Fork 2a (resolved): standardize the dockable layout-tree as a first-class WE Protocol
(`we:src/_data/protocols/`) — the convergent core schema node `{type: row|column|stack, children|tabs, size}`
that dockview / FlexLayout / golden-layout all emit, plus an **open extension slot** for the divergent
popout-state / per-panel-metadata / constraint encodings. Conformance = round-trip the tree. The
*whether-protocol* call is already settled (#1437 Fork 2a); this item is purely the **build** — author the
Protocol entry once the convergence gate clears.

## The work

Author the `we:src/_data/protocols/` entry for the dockable layout-tree: the core schema node, the extension
slot, and the round-trip conformance vectors. Source the convergent vocabulary from the survey in
[`we:reports/2026-06-21-docking-tiling-partition-tree.md`](reports/2026-06-21-docking-tiling-partition-tree.md)
/ the `docking-tiling-partition-tree` research topic.

## Blocked on the protocol-bar gate, not a maturity park

The [`#project-protocol-bar`](docs/agent/platform-decisions.md#project-protocol-bar) rule mints a Protocol
entry only **after a second conforming impl validates the core schema** — minting on one impl is the flawed
branch (a one-impl "convergent" schema is just that impl's shape, and can't exercise the extension slot's
divergence). Today only one conforming impl exists: FUI dockable render (#1511–#1514, all resolved) over
`we:blocks/dockable/contract.ts`. The second independent impl is now a **tracked build** —
[#1627](/backlog/1627-build-a-dockview-adapter-that-round-trips-the-dockable-core-/) (dockview adapter) — so
this is a real `blockedBy: [1627]` edge, **not** a `maturityGated` park waiting for an external consumer to
spontaneously appear. When #1627's round-trip passes the gate clears and this item is unblocked to mint.

## Pre-flight (batch-2026-06-22-1627-1624-1597) — convergence gate CLEARED, but an ownership fork surfaced → `blockedBy: 1627 → 1653`

#1627 (the dockview adapter, conforming impl family #2) **resolved this batch**, so the
`#project-protocol-bar` convergence gate is satisfied — the mint no longer waits on a second impl. But
grounding the actual authoring surfaced a fork #1437 left open: a WE `we:src/_data/protocols/*.json` entry
**requires** an `ownedByProject` that resolves in `we:src/_data/projects.json` **and** carries a
`<section id="protocol-<id>">` anchor in `we:src/_includes/project-<id>.njk` (enforced by `validateProtocol`,
`we:scripts/check-standards-rules.mjs:760`; no project-less escape hatch exists). Yet #1437 Fork 1 ratified
the dockable family as **"intent + composing block, no project"** while Fork 2 made the layout tree a
**first-class Protocol** — and no existing project is a clean owner. Which project owns the protocol (mint one /
attach to an existing one / relax the project-required rule) is a real design call, **not** mechanical
authoring, so this card is `blocked-in-fact` on that decision. Filed as
[#1653](/backlog/1653-which-project-owns-the-dockable-layout-tree-protocol-1437-ru/) and re-pointed
`blockedBy: 1627 → 1653`. Un-blocks to mint once #1653 ratifies an owner.
