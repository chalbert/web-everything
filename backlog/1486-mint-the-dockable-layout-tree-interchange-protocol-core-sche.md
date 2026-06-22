---
kind: decision
status: open
parkedDate: "2026-06-22"
dateOpened: "2026-06-21"
tags: []
---

# Mint the dockable layout-tree interchange Protocol (core schema + extension slot)

**Decision (un-parked 2026-06-22 — parking is not a prioritisation escape):** Whether to mint the dockable layout-tree as a first-class WE Protocol now — gated on a second conforming consumer (project-protocol-bar rule).

Realizing build of #1437 Fork 2a: standardize the dockable layout-tree as a first-class WE Protocol (we:src/_data/protocols/) — the convergent core schema node = {type: row|column|stack, children|tabs, size} that dockview/FlexLayout/golden-layout all emit, plus an OPEN EXTENSION SLOT for the divergent popout-state / per-panel-metadata / constraint encodings. Conformance = round-trip the tree. Per the #project-protocol-bar temporal rule the protocol entry is extracted once a second conforming impl validates the core schema — so this is blockedBy the realizing block build, not minted ahead of it.

## Parked 2026-06-22 (batch pre-flight) — protocol-bar temporal gate unmet

Parked `deferred`: the #project-protocol-bar rule mints a Protocol entry only **after a second conforming
impl validates the core schema**. Today only **one** conforming impl exists (FUI dockable render #1511,
resolved) plus the WE contract (`we:blocks/dockable/contract.ts`); `we:blocks/dockable/` holds no impl and
no second-family adapter (dockview/FlexLayout/golden-layout) has been built against the schema. Minting now
would violate the temporal bar (a one-impl "convergent" schema is just that impl's shape). **Trigger to
un-park:** a second independent impl/adapter round-trips the `{type: row|column|stack, children|tabs, size}`
core — then extract the entry. Not agent-resolvable until that exists.
