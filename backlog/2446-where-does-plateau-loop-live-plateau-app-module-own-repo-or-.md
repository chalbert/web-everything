---
bornAs: xljqux3
kind: decision
parent: "2445"
size: 3
status: open
priority: low
dateOpened: "2026-07-11"
tags: [plateau-loop, constellation, placement]
---

# Where does Plateau Loop live — plateau-app module, own repo, or product line inside Plateau

Constellation placement for the coordinator: inside plateau-app (tools/ sibling of dev-panel), a fourth repo, or the core of the Plateau product itself. Weighs repo-constellation rules (WE zero-impl), multi-project registry needs, and later SaaS packaging.

> **Deferred (2026-07-11 red team — operator call).** Ratifying placement now would decide the biggest
> question with the least information. The phase-1 resident drain daemon
> ([#2449](/backlog/2449-ship-the-phase-1-resident-drain-daemon-merge-queue-only/)) starts
> **provisionally in plateau-app** next to the dev-panel (the #1565/#1579 devtools-are-Plateau-owned
> priors) — cheap to move while small, and explicitly *without prejudice* to this call. Prepare/ratify
> once the daemon's operating evidence shows whether the extraction wants to grow. Two red-team notes
> for the eventual forks: weigh SaaS packaging lightly (speculative product framing shouldn't inflate an
> internal-tooling decision), and every option must carry the gate-self re-anchoring cost
> ([#2448](/backlog/2448-re-anchor-the-gate-self-trust-chain-when-the-delivery-engine/)).
> `priority: low`: pickable, out of auto-select.

## The question

The parent epic ([#2445](/backlog/2445-plateau-loop-extract-the-delivery-machinery-into-a-coordinat/))
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
