---
type: idea
workItem: story
size: 5
parent: "777"
status: parked
blockedBy: ["865"]
dateOpened: "2026-06-17"
tags: []
---

# Migrate WE-docs page-level UI to FUI components (tiles/tables/badges/code-frame)

Replace catalog tiles/cards, tables, badges, and code-sample surfaces across src/*.njk with FUI component impl, mounted via the mode-C SDK. Follows the chrome migration slice (#865) and reuses its mount pattern + theme bundle (#864).

## Pre-flight — blocked-in-fact on absent FUI page-UI block impls (batch-2026-06-18)

#865 (chrome mount pattern) + #864 (theme bundle) are resolved, but this card mounts **FUI page-UI block
impls that don't exist yet**: verified `fui:frontierui/blocks/` has no `tile`/`card`/`catalog-tile`/`badge`/
`code-frame`/`code-sample`/`code-view` dir (only `data-table` of the named set). The mode-C mount pattern
(#865) is ready, but there is nothing to mount until those FUI block impls are built (the broader
FUI-block-impl effort; the concurrent #916–#923 cluster builds a *different* block set). Not claimable as a
batch slice until the tile/card/table/badge/code-frame FUI components exist — `blocked-in-fact`. Left `open`;
needs the FUI page-UI components built (or scaffolded) first.
