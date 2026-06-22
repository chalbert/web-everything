---
kind: story
size: 3
parent: "777"
status: resolved
locus: frontierui
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: "blocks/filter-chip (badge pre-existed #1288)"
tags: []
---

# FUI: expose badge + filter-chip components for backlog-badge dogfooding

Frontier UI must expose the `badge` and `filter-chip` components (the must-build gap the #778 inventory
mapped) before #1208 can migrate the `/backlog/` tile, Prioritisation table, and detail-page badges/chips
onto them. There was no open WE-side item carrying this prerequisite, so #1208 was parked on a prose
"blocked-in-fact" note; this card makes that a **real `blockedBy` edge** (parking is not a prioritisation
escape — 2026-06-22 parked-item sweep).

## Scope

- Ship `badge` and `filter-chip` as consumable FUI components (the #778 must-build gap under dogfooding
  epic #777).
- Then #1208 (`blockedBy: 1603`) swaps the WE-docs hand-written badge/chip markup for them.

## Blocks

- #1208 — Dogfood the backlog badges/chips onto FUI badge + filter-chip.
