---
kind: story
size: 8
status: resolved
dateOpened: "2026-07-18"
dateStarted: "2026-07-18"
dateResolved: "2026-07-18"
graduatedTo: "we:contracts/graph.ts (swimlane LayoutStrategy)"
tags:
  - standards
  - web-graph
  - swimlane
  - layout
  - console-board
---

# Add a `swimlane` layout mode to the Web Graph standard

Graduated from decision [#2533](/backlog/2533-console-board-derived-ui-standards.md) (Fork 7). Ratified: add a **lane-constrained layout variant** to the ratified **Web Graph** contract (`we:contracts/graph.ts`, #1289/#1352) — NOT a new sibling intent, and NOT app-custom choreography.

Web Graph already owns nodes/edges and fork/fan-in topology. The residue this mode adds, once CSS Grid (`grid-column` for contiguous lanes/spans) and the existing graph wires are subtracted, is a **lane-constrained layout**: the assignment of nodes to lanes plus the fork/rejoin routing that honors those lanes. Contract shape:

- **Lane assignment** — each node is placed in a `lane`/`track`; lanes render as columns (or rows).
- **Fork / fan-in routing** — a lane can fork into sub-columns that re-join at a fan-in node, with wires routed to respect lane boundaries.
- It belongs **on** `we:contracts/graph.ts` as a `swimlane` layout mode, because that standard already owns the fork/fan-in topology. A standalone swimlane intent would re-derive graph layout — rejected.

**Prior art (lane-constrained layout is a studied, named algorithm):** **BPMN** literally names them "swimlanes" (pools/lanes); **git commit graphs** (GitKraken, `git log --graph`, GitHub network) assign branches to lanes; **subway/metro-map** line layout; kanban swimlanes (Jira, Trello, Azure Boards); DAW track lanes. This is a genuine residue beyond CSS Grid (which can't route fork/fan-in wires) AND beyond general layered-DAG layout (which has no lane constraint).

**Acceptance:** `we:contracts/graph.ts` gains a `swimlane` layout mode expressing lane assignment + fork/fan-in routing under a lane constraint; it is a layout variant on the existing graph standard (no new sibling intent); the prior art is cited; the change passes `check:standards`.
