---
kind: story
size: 13
unsplittableReason: foundational
blockedBy: ["1351"]
locus: frontierui
status: open
dateOpened: "2026-06-20"
dateStarted: "2026-06-21"
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

## Progress

- **Status:** open (released 2026-06-21 — blocked-by-design, not workable now).
- **Reconciliation (2026-06-21):** the spec pass this card called for is **already filed** as the
  WebGraph standard chain — **[#1352](/backlog/1352-webgraph-standard-shape-own-project-protocol-seam-count-a11y/)**
  (prepared shape decision: project placement · protocol seam count · a11y model · default layout) →
  **[#1351](/backlog/1351-scaffold-the-webgraph-standard-project-graphspec-profile-lay/)** (scaffolds the
  WE `GraphSpec` + `CustomGraphRenderer` contract). This card is the **foundational FUI build slice**
  downstream of that contract, so its true edge is `blockedBy: ["1351"]` (added — it was missing, which is
  why the ranker mis-surfaced this as agent-ready). **Do not build until #1351 lands the contract**, then
  re-run `/split 1289` to carve the FUI renderer slices (mirrors the webcharts #570/#1004 → #1292 shape;
  native-first SVG `SvgGraphRenderer` modelled on `fui:charts/SvgChartRenderer.ts`, layered-DAG layout per
  the existing `plateau:src/platform-manager/platform-map.ts`). **Next real work = ratify #1352.**
