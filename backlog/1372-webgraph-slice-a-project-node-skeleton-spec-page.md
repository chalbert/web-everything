---
kind: task
parent: "1351"
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: src/_data/projects/webgraph.json
tags: []
---

# webgraph slice A — project node + skeleton spec page

First scaffold slice of the webgraph standard (epic #1351): stand up the project node we:src/_data/projects/webgraph.json + spec page we:src/_includes/project-webgraph.njk + we:assets/icons/webgraph.svg, so the project tile renders at /projects/webgraph/. Mirrors webcharts slice #571. Root slice — B (profile) and C (protocols) build on it. Shape settled by #1352.

## Progress (batch-2026-06-20-1372-1369)

Done. Mirrored the webcharts slice-A skeleton:
- `we:src/_data/projects/webgraph.json` — project node (`status: concept`, `category: standard`,
  icon `/assets/icons/webgraph.svg`); description carries the #1352 shape (own project · two seams
  `CustomGraphLayout` ⟂ `CustomGraphRenderer` · deterministic layered-DAG + native-first SVG defaults ·
  3-axis a11y-first conformance).
- `we:src/assets/icons/webgraph.svg` — layered-DAG node-link icon reusing the shared webcharts palette/frame.
- `we:src/_includes/project-webgraph.njk` — skeleton spec page (Mission · Scope with the two-seam design ·
  status note) marking GraphSpec (slice B #1373), protocols (slice C #1374), conformance (slice D #1376),
  a11y research (slice E #1375) as forthcoming.

Renders at `/projects/webgraph/`; tile renders on the home/projects index. Verified on :8080.
