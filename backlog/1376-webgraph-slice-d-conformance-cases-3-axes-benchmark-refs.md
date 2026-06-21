---
kind: task
parent: "1351"
status: resolved
blockedBy: ["1373", "1374"]
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: src/cases/webgraph/01-semantic-fidelity.html
tags: []
---

# webgraph slice D — conformance cases (3 axes) + benchmark refs

webgraph epic #1351 slice D: author the conformance cases under we:src/cases/webgraph/ scoring the 3 axes (semantic fidelity, theme application, accessibility — tier-1 adjacency description-table floor), mirroring webcharts slice #574 / we:src/cases/webcharts/. Also add the graph libraries (D3-force, ELK/dagre, Cytoscape, Mermaid, reaflow) to we:src/_data/references.json. Blocked by slice B (#1373, profile) and slice C (#1374, protocols).

## Progress (batch-2026-06-20-1372-1369)

Done (mirrors webcharts slice #574 / `we:src/cases/webcharts/`). Authored **3 conformance cases** under
`we:src/cases/webgraph/` — static declarations (a `<script type="application/vnd.webgraph+json">` GraphSpec +
an EXPECTED-output comment per axis, the webcharts pattern; no renderer is run, so they stand without the
not-yet-built FUI runtime):
- `01-semantic-fidelity.html` — every node→one mark, every edge→one link between its declared endpoints
  (structure preserved; position is the layout's, not asserted).
- `02-theme-application.html` — node `kind`→palette token, edge `weight`→stroke scale, all from webtheme, no
  literals.
- `03-a11y-adjacency-description.html` — the tier-1 adjacency description-table floor, derived mechanically
  from the spec (nodes→rows, outgoing edges→adjacency list, `description`→caption).

All three use the real **constellation graph** as a dogfood (FUI implements WE; Plateau consumes FUI). Added
the **6 graph-library refs** (D3-force, ELK, dagre, Cytoscape, Mermaid, reaflow) to
`we:src/_data/references/ui-interaction.json`, each contextualized as a layout/renderer adapter or node-link
prior art. Cases render at `/cases/webgraph/0*/` (HTTP 200, verified :8080); build clean; gate 0 errors.

**Completes the webgraph scaffold epic #1351** — slices A (#1372) · B (#1373) · C (#1374) · D (#1376) ·
E (#1375) all resolved. #1351 is now reconcilable (all children done).
