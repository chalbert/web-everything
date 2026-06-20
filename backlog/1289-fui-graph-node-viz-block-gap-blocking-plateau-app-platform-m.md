---
kind: story
size: 13
locus: frontierui
status: open
dateOpened: "2026-06-20"
tags: [fui, gap, dogfood, plateau-app]
---

> **Not batchable as one — needs a spec first (sized 8 → 13, batch-2026-06-20 pre-flight).** This is a
> **greenfield graph/node-visualization block** with **no spec/acceptance** (a pure gap-marker): no
> defined API, layout algorithm (force-directed? layered/DAG? — the Platform Map is a DAG), node/edge
> data contract, interaction model, or graph-a11y story (graph a11y is genuinely hard). FUI ships no viz
> primitive to build on. The card also carries an **open scoping question** (build the block vs. accept
> the Platform Map's hand-rolled viz as a documented standing gap — prioritization, leaning "build" per
> first-party-dogfood). Needs a `/new-standard` (or design) pass to define the contract + scope before any
> build slice — below DoR as one item. Same class as sibling gap #1286.

# FUI graph/node-viz block — gap blocking plateau-app Platform Map dogfood

FUI has no graph/node-visualization block. The #1254 plateau-app dogfood found its Platform Map (we:plateau:src/platform-manager/platform-map.ts) hand-rolls node/graph viz; the epic itself flagged this as 'likely a gap to file'. Could-not-split until FUI ships graph viz. Open scoping question (prioritization, not a design fork): build a FUI graph-viz block vs. accept Platform Map as a documented standing gap — decide at prioritization time. Per first-party-dogfood, file the gap. locus: frontierui.
