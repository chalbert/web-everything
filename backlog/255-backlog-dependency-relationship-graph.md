---
type: idea
status: resolved
workItem: story
size: 5
dateOpened: "2026-06-09"
dateStarted: "2026-06-09"
dateResolved: "2026-06-09"
graduatedTo: none
blockedBy: ["254"]
tags: [backlog, tooling, ui, visualization, prioritisation]
---

# A dependency relationship graph for the backlog — see the `blockedBy` edges as a diagram

The Prioritisation tab (#254) ranks items by how many others they unblock, but the *shape* of the
dependency network — chains, hubs, clusters, the one node everything hangs off — is far easier to read
as a graph than a list. This adds a visual node/edge diagram of the backlog's `blockedBy` relationships,
as a view on `/backlog/` (its own tab, or a panel within the Prioritisation tab).

Depends on **#254** — it reuses the loader-derived `dependents` (reverse-edge) data and the
unblock-leverage score that #254 introduces; this story is the visualization layer over that data, not a
re-derivation of it.

## Open design points (decide during the work)

- **Rendering approach.** Hand-rolled SVG (zero deps, full control, more layout work) vs. a small graph
  lib (e.g. a force-directed/DAG layout) — weigh the bundle/dependency cost against layout effort. The
  repo's native-first default leans toward no-dep SVG if the graph stays small; revisit if the node count
  makes manual layout impractical.
- **Scope of nodes.** All items, or only `open` + their prerequisite chains? A full-graph view is
  complete but noisy; an open-only view answers "what's the critical path to my ready work?" more directly.
- **Node encoding.** Colour nodes by tier (reuse the #249 A/B/C palette), size by unblock-leverage, and
  link `blockedBy` as directed edges. Clicking a node should deep-link to `/backlog/<NNN-slug>/`.

## Build (skeleton)

- A `priority-graph` panel/tab in [we:src/backlog.njk](src/backlog.njk) rendering nodes (items) + directed
  edges (`blockedBy`), driven by the #254 `dependents`/leverage data exposed to the template or a small
  JSON the loader emits.
- Tier-coloured, leverage-sized nodes; directed edges; click-through to the item page; a legend.
- Degrade gracefully when the graph is empty or a single chain.

## Acceptance criteria

- `/backlog/` shows a dependency graph of `blockedBy` relationships, with nodes coloured by tier and
  edges directed prerequisite → dependent.
- Clicking a node navigates to that item's detail page.
- The graph is built from the same deterministic reverse-edge data as #254 (no separate dependency model).

## Resolution of the open design points

- **Rendering approach → hand-rolled SVG, zero deps.** Honours the repo's native-first default; the graph
  is sparse enough (~40 nodes) that a layered column layout is tractable without a graph library.
- **Scope of nodes → all edge-participants.** Every item with degree > 0 (a prerequisite or a dependent),
  open or resolved, so the full chain context is visible. The open-only "critical path" view is split out
  as a follow-up toggle (#257) rather than baked in.
- **Node encoding → tier colour + leverage size + directed edges + click-through**, exactly as proposed.

## Progress

- **Status:** resolved (2026-06-09)
- **Branch:** docs/standard-authoring-workflow
- **Done:**
  - **Graph data** ([we:src/_data/backlogGraph.js](src/_data/backlogGraph.js)): emits `{ nodes, edges, layer }`
    from the #254 reverse-edge/leverage fields — nodes = items with a `blockedBy` edge, `layer` = longest
    prerequisite-chain depth (cycle-safe memoised DFS), edges directed prerequisite → dependent. Pure +
    deterministic.
  - **Renderer** ([we:src/assets/js/backlog-graph.js](src/assets/js/backlog-graph.js)): hand-rolled SVG (no
    lib) — connected-component grouping, layered column layout, tier-coloured + leverage-sized nodes,
    arrowhead edges, `<a>` click-through to each item, hover `<title>` with unblock counts.
  - **Graph tab** ([we:src/backlog.njk](src/backlog.njk)): 4th `data-bd-tab="graph"` tab + `#panel-graph` with
    legend + SVG + JSON blob; wired into the tab switcher
    ([we:src/assets/js/backlog-burndown.js](src/assets/js/backlog-burndown.js)) via one `panels` entry.
  - **Tests:** 5 model-invariant tests ([we:src/_data/__tests__/backlogGraph.test.ts](src/_data/__tests__/backlogGraph.test.ts))
    + 5 happy-dom render tests ([we:src/assets/js/__tests__/backlog-graph-render.test.ts](src/assets/js/__tests__/backlog-graph-render.test.ts)) —
    all green. `check:standards` 0 errors.
  - Verified visually via a headless Playwright screenshot of the real data (40 nodes / 29 edges) — the
    readiness chains (248→249→250→252→253, 248→254→255) and 125's fan-out render correctly.
- **Next:** none — resolved. Open-only filter follow-up captured as #257.
- **Notes:** the live dev server (started pre-session) didn't hot-rebuild the `.njk`/new assets; verification
  was via standalone 11ty build + Playwright on the real data. A server restart (yours, left as-is) surfaces
  it live at `/backlog/` → Graph tab.
