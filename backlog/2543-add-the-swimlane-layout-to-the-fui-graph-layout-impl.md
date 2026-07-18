---
bornAs: xwdsqp9
kind: story
size: 5
parent: "2541"
status: open
locus: frontierui
dateOpened: "2026-07-18"
tags:
  - frontier-ui
  - web-graph
  - swimlane
  - implementation
  - console-board
crossRef: { url: /projects/webgraph/, label: Web Graph }
relatedProject: webgraph
---

# Add the swimlane layout to the FUI graph layout impl

The Web Graph standard gained a `swimlane` `LayoutStrategy` ([#2537](/backlog/2537-add-a-swimlane-layout-mode-to-the-web-graph-standard.md), `we:contracts/graph.ts` / `we:graphs/contract.ts`). The runtime lives in Frontier UI (statute #1290) — extend FUI's native-first deterministic graph layout (#1444) to implement it.

**Scope:** a `CustomGraphLayout` with `strategy: 'swimlane'` that:
- Reads `GraphNodeSpec.lane` (the ordered partition) and lays lanes out as columns/rows in `GraphSpec.lanes` order.
- Routes fork/fan-in edges to honor lane boundaries (a lane forks into sub-columns that re-join at a fan-in node).
- Is **deterministic and conformance-assertable** (same spec → same coordinates), like the `layered` default — NOT an adapter behind the seam.

Emits a `PositionedGraph` (coordinates only); the existing SVG renderer draws it unchanged (the two-seam split means no renderer change is needed). Prior art to honor: BPMN pools/lanes, git-graph lane assignment, subway-map layout.

**Acceptance:** FUI ships a `swimlane` layout satisfying `CustomGraphLayout` (`fui:` impl, #1444 family), registered so `layout: 'swimlane'` resolves; a demo renders lane-assigned nodes with fork/fan-in routing; deterministic-layout conformance asserted; the WE `GraphSpec` is untouched (spec is the only lock).
