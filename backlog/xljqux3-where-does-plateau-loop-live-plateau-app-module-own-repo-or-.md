---
kind: decision
parent: "xhmav8a"
size: 3
status: open
dateOpened: "2026-07-11"
tags: [plateau-loop, constellation, placement]
---

# Where does Plateau Loop live — plateau-app module, own repo, or product line inside Plateau

Constellation placement for the coordinator: inside plateau-app (tools/ sibling of dev-panel), a fourth repo, or the core of the Plateau product itself. Weighs repo-constellation rules (WE zero-impl), multi-project registry needs, and later SaaS packaging.

## The question

The parent epic ([#xhmav8a](/backlog/xhmav8a-plateau-loop-extract-the-delivery-machinery-into-a-coordinat/))
extracts the delivery machinery (lane pool, pr-land, drain, review contracts, backlog CLI —
today all under `we:scripts/`) into a resident coordinator managing multiple projects. WE
holds zero implementation by statute, so the engine must move out. Where to?

## Options (unprepared — forks to be authored by /prepare)

- **plateau-app module** — lands next to the proven UI↔CLI bridge (`plateau:tools/dev-panel/`,
  the spec-explorer plugin; #1565/#1579 already ruled devtools are Plateau-owned). Cheapest
  start; risks entangling coordinator lifecycle with the app product.
- **Own repo (fourth constellation member)** — clean self-hosting story (the Loop improves
  itself in a lane and reloads without touching other products), clean SaaS packaging;
  costs constellation overhead (CI, drain parity #2241, one more checkout).
- **Core of the Plateau product** — "Plateau Loop" as a product line: the coordinator IS
  Plateau's delivery surface. Strongest product framing; largest scope commitment.

Related priors: #1565 (devtool placement), #1579 (dev-panel relocation), #2241
(constellation transport parity), the cross-repo tool-engine/product-boundary research topic.
