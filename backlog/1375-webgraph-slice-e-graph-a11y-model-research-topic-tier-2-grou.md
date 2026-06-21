---
kind: task
parent: "1351"
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: src/_data/researchTopics/graph-a11y-model.json
tags: []
---

# webgraph slice E — graph-a11y model research topic (tier-2 grounding)

webgraph epic #1351 slice E: spin a /research/ topic grounding the tier-2 graph-a11y model (treegrid / ARIA graph-role traversal) mandated by #1352 fork 3 — graph a11y has no settled platform pattern, so tier-2 must be researched before it is specced. Independent of the code path (the tier-1 adjacency description-table floor is already settled). Lands a research-topic markdown under we:src/_data/research/. No code blocker.

## Progress (batch-2026-06-20-1372-1369)

Done. Research topics actually live in `we:src/_data/researchTopics/<id>.json` (+ a required matching
`we:src/_includes/research-descriptions/<id>.njk` partial — the page include is not `ignore missing`, so
both are mandatory). Authored topic **`graph-a11y-model`**:
- `we:src/_data/researchTopics/graph-a11y-model.json` — `status: open`, `relatedProject: webgraph`,
  `reviewHorizon: P1Y`, summary framing the tier-2 question + the recommended (not decided) direction.
- `we:src/_includes/research-descriptions/graph-a11y-model.njk` — the survey: why list/tree/Graphics-Module
  patterns only half-fit a cyclic multigraph; the strongest prior art (**Olli**, **Data Navigator**,
  Highcharts a11y, Mermaid `accTitle`/`accDescr`, the Cytoscape/sigma/force-graph no-a11y gap); **Chartability**
  as the scoring rubric; a provisional 3-tier model (tier-1 table floor · tier-2 Graphics-roles + structure-
  derived keyboard traversal from GraphSpec adjacency · tier-3 sonification); real W3C/library sources.

Grounds the slice-D (#1376) a11y conformance axis. Renders at `/research/graph-a11y-model/` (verified :8080).
