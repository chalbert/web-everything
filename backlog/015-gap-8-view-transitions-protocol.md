---
type: decision
workItem: story
size: 3
status: resolved
dateOpened: "2026-05-31"
dateResolved: "2026-06-11"
graduatedTo: none
tags: [gap-analysis, protocol, view-transitions, motion]
---

# Decide on View Transitions protocol (gap #8)

`motion` covers physics but not the View Transitions API (same- and cross-document). The `semantics.json` PopoverController entry already references "View Transitions integration." Likely a **protocol under a motion/navigation project** rather than its own project.

## Triage context

- **Kind**: Protocol
- **Native grounding**: View Transitions API (same- & cross-document)
- **Native-first**: ▲ high · **Gap**: ◆ medium · **Effort**: ◆ medium
- **Rank**: 8 — under motion/nav

## Open call

Confirm the home (motion vs navigation project) and the protocol scope.

## Resolution (2026-06-11)
**Protocol, home = the navigation project — settled by the per-fork classification pass.** Cross/same-document View Transitions is a *routing artifact* (it fires on a document/navigation transition), so it sits at the navigation seam (Q7), not the `motion` physics axis — `motion` tunes *feel*, View Transitions coordinates the *transition itself*. It is a **Protocol** (Q1/Q2: independent frameworks must conform to the same transition-coordination contract), **not its own project** and **not a `motion` dimension** — surfaced as a `protocol-{view-transitions}` section owned by the navigation project (protocol-is-first-class). Authoring the contract (same- vs cross-document scope, `::view-transition` wiring, transition type/name vocabulary, motion hand-off) is a separate greenfield build that runs the prep pass first.
