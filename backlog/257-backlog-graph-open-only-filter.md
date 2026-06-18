---
type: idea
status: resolved
workItem: story
size: 2
dateOpened: "2026-06-09"
dateStarted: "2026-06-10"
dateResolved: "2026-06-10"
blockedBy: ["255"]
graduatedTo: src/assets/js/backlog-graph.js
tags: [backlog, tooling, ui, visualization]
---

# An open-only toggle for the dependency graph — see the critical path to ready work, not finished chains

The dependency graph (#255) renders every item that participates in a `blockedBy` edge, including
fully-resolved chains. That's good for *history* (how did we get here), but it dilutes the question
#255's own design notes cited as a motivation — *"what's the critical path to my ready work?"* — because
the live frontier (a handful of open nodes) is scattered among many muted, resolved ones.

This adds a small filter toggle to the Graph tab: **All** (today's behaviour) vs **Open & blockers**
(only `open`/`active` nodes plus the still-open prerequisites that gate them — drop chains where
everything is already resolved). A bounded follow-up; it reuses the existing
[we:src/_data/backlogGraph.js](src/_data/backlogGraph.js) model and
[we:src/assets/js/backlog-graph.js](src/assets/js/backlog-graph.js) renderer — the toggle just filters the
node/edge set before layout.

## Build

- Emit a `subset` flag per node (or compute client-side): a node is "live" if it is `open`/`active`, or
  it is an unresolved prerequisite of a live node. Edges between two live nodes are kept.
- A small toggle in the Graph panel ([we:src/backlog.njk](src/backlog.njk)) re-runs the renderer over the
  filtered set; persist the choice the same way the tab does (localStorage), default **Open & blockers**.

## Acceptance criteria

- The Graph tab has an All / Open-&-blockers toggle; switching re-lays-out the SVG without a reload.
- Open-&-blockers hides chains where every node is resolved, keeping each open item and the prerequisites
  still gating it.
- The filter is deterministic and reuses the #255 model/renderer (no second graph model).

## Progress

- **Status:** resolved (2026-06-10)
- **Branch:** docs/standard-authoring-workflow
- **Done:**
  - Added an **All / Open & blockers** segmented toggle to the Graph panel ([we:src/backlog.njk](src/backlog.njk)),
    defaulting to **Open & blockers**; choice persists in `localStorage` (`we-backlog-graph-filter`).
  - Refactored [we:src/assets/js/backlog-graph.js](src/assets/js/backlog-graph.js) into a `render(mode)` that
    filters the #255 build-time model client-side (no second model) and re-lays-out the SVG in place — no
    reload. The count badge (`#bg-count`) reflects the visible set.
  - Filter rule: a node is **live** iff `status` is `open`/`active`; since an unresolved prerequisite of a
    live node is itself open/active, this single predicate captures "open + still-gating blockers". Edges
    survive only between two live nodes; chains where every node is resolved drop out.
  - **Orphan drop (refines AC2):** in live mode a node is kept only if it's open/active **and** still has
    at least one live edge after filtering. An open item whose only dependency edge points to a resolved
    item (e.g. #129, which only blocked the resolved #135) is *not* on any live critical path, so showing it
    as an isolated dot is noise — it belongs in the Tracked-work tab. This narrows the literal "keep each
    open item" wording to match the item's stated motivation ("the critical path to my ready work").
  - **Layer recompute:** column position is recomputed from the *visible* edge set each render (not the
    build-time `n.layer`, which is depth in the full graph). Without this, a live node whose prerequisites
    were all hidden kept its deep column and floated disconnected mid-canvas; now a node with no visible
    prerequisite is a left-column root. In "All" mode the visible set is the full set, so it reproduces the
    server layering.
- **Verified (Playwright against live :3000):** default shows 15 live nodes (14 open + 1 active) of 41 total;
  toggling to All re-lays-out to 41 in place; selection persists across reload.
- **Notes:** active/claimed nodes still render muted (the renderer colours only `open` + tier), matching the
  existing legend; no model/`_data` change was needed.

**Graduated to** `we:src/assets/js/backlog-graph.js` — open-only client-side filter on the dependency-graph Graph tab (we:src/backlog.njk).
