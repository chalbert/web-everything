---
kind: story
size: 3
status: open
dateOpened: "2026-06-21"
tags: []
---

# Mint the dockable layout-tree interchange Protocol (core schema + extension slot)

Realizing build of #1437 Fork 2a: standardize the dockable layout-tree as a first-class WE Protocol (we:src/_data/protocols/) — the convergent core schema node = {type: row|column|stack, children|tabs, size} that dockview/FlexLayout/golden-layout all emit, plus an OPEN EXTENSION SLOT for the divergent popout-state / per-panel-metadata / constraint encodings. Conformance = round-trip the tree. Per the #project-protocol-bar temporal rule the protocol entry is extracted once a second conforming impl validates the core schema — so this is blockedBy the realizing block build, not minted ahead of it.
