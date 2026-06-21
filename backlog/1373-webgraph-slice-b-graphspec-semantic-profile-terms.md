---
kind: task
parent: "1351"
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: src/_includes/project-webgraph.njk
tags: []
---

# webgraph slice B — GraphSpec semantic profile + terms

webgraph epic #1351 slice B: author the GraphSpec node/edge semantic profile (presentation-free) in we:src/_data/semantics.json, grounded on the existing plateau:src/platform-manager/types.ts GraphNode/GraphEdge shapes, plus the four new terms graph-spec, node-link diagram, layout strategy, adjacency description. Mirrors webcharts slice #572. Blocked by slice A (#1372).

## Progress (batch-2026-06-20-1372-1369)

Done (mirrors webcharts slice #572). Authored the **GraphSpec Profile** section in
`we:src/_includes/project-webgraph.njk` — a `{% highlight typescript %}` block defining the presentation-free
`GraphSpec` / `GraphNodeSpec` / `GraphEdgeSpec` + `LayoutStrategy` interfaces, grounded on
`plateau:src/platform-manager/types.ts` `GraphNode`/`GraphEdge`, with the semantic-vs-presentation principles
(position is *invented* not derived → the two-seam split; `kind`/`group`/`weight` semantic, resolved style =
theme; thin core + additive tiers; a11y derivable from labels+edges). Authored the **4 epic-mandated terms**
as `we:src/_data/semantics/<slug>.json`: GraphSpec, Node-Link Diagram, Layout Strategy, Adjacency Description.
Cleared the now-stale `blockedBy: 1372` (slice A resolved). Renders at `/projects/webgraph/#graphspec`
(verified :8080); gate 0 errors, 282 terms, no duplicate-term errors.
