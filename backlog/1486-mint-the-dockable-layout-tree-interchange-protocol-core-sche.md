---
kind: decision
status: parked
parkedReason: deferred
parkedDate: "2026-06-22"
dateOpened: "2026-06-21"
tags: []
---

# Mint the dockable layout-tree interchange Protocol (core schema + extension slot)

**Parked (`deferred`) on a ratified temporal gate — not a preparable fork right now.** Realizing build
of [#1437](/backlog/1437-decision-docking-tiling-dockable-window-management-placement-/) Fork 2a (resolved):
standardize the dockable layout-tree as a first-class WE Protocol (`we:src/_data/protocols/`) — the
convergent core schema node `{type: row|column|stack, children|tabs, size}` that dockview / FlexLayout /
golden-layout all emit, plus an **open extension slot** for the divergent popout-state / per-panel-metadata /
constraint encodings. Conformance = round-trip the tree. The *whether-protocol* call is already settled
(#1437 Fork 2a); what remains is purely the **when**, and that is forced by a ratified rule, so there is
no judgment to bring to DoR.

## Why it's gated, not preparable — the protocol-bar temporal rule

The [`#project-protocol-bar`](docs/agent/platform-decisions.md#project-protocol-bar) rule mints a Protocol
entry only **after a second conforming impl validates the core schema**. Minting on one impl is the
*flawed branch* — a one-impl "convergent" schema is just that impl's shape, so it cannot prove convergence
or exercise the extension slot's divergence. "Wait for the 2nd impl" is therefore forced, not a weighable
choice — which is exactly why this is a park, not a `## Fork`.

**Today only one conforming impl exists:** FUI dockable render (#1511–#1514, all resolved) over the WE
contract (`we:blocks/dockable/contract.ts`). The realizing block epic (#1485) and its slices are resolved,
but `we:blocks/dockable/` holds no impl and **no second-family adapter** (dockview / FlexLayout /
golden-layout) has been built against the schema, and no backlog item yet tracks building one (so this is a
`parkedReason: deferred`, not a single `blockedBy` edge).

**Un-park trigger:** a second independent impl/adapter round-trips the `{type: row|column|stack,
children|tabs, size}` core against `we:blocks/dockable/contract.ts` — then extract the Protocol entry
(`we:src/_data/protocols/`) and resolve. The cross-library convergence evidence is already surveyed in
[`we:reports/2026-06-21-docking-tiling-partition-tree.md`](reports/2026-06-21-docking-tiling-partition-tree.md)
/ the `docking-tiling-partition-tree` research topic, so the mint will be fast once the gate clears.
