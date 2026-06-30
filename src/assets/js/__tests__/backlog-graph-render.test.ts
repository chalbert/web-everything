// Render smoke test for the dependency-graph SVG drawer (#255). Runs the asset IIFE
// (src/assets/js/backlog-graph.js) against a happy-dom document seeded with the real graph data, and
// asserts it draws one node per node and one edge per edge, sets a viewBox, and links each node to its
// item page. Eval'd (not imported) so the IIFE re-runs cleanly per case without module caching.
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const SCRIPT = readFileSync(join(here, '..', 'backlog-graph.js'), 'utf8');
const graph = require('../../../_data/backlogGraph.js')();

function mount(data: unknown) {
  document.body.innerHTML =
    '<div id="panel-graph" hidden>' +
    '<svg id="backlog-graph"></svg>' +
    '<script type="application/json" id="backlog-graph-data"></script>' +
    '</div>';
  // The renderer's filter toggle (#257) defaults to "live" (open/active nodes only). These structural
  // assertions check the FULL model renders (one circle per node, one line per edge), so force the
  // "all" view via the persisted-mode lever the IIFE reads on start.
  try { localStorage.setItem('we-backlog-graph-filter', 'all'); } catch { /* no localStorage — IIFE falls back to its default */ }
  // textContent avoids the browser trying to parse the JSON as HTML.
  document.getElementById('backlog-graph-data')!.textContent = JSON.stringify(data);
  // eslint-disable-next-line no-new-func — run the IIFE against this document, fresh each call.
  new Function(SCRIPT)();
  return document.getElementById('backlog-graph')!;
}

describe('backlog dependency graph — SVG rendering', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('draws one node per rendered node and one line per edge (All view = edge participants)', () => {
    const svg = mount(graph); // forces the "all" view, which renders only edge-participating nodes (#257)
    const rendered = graph.nodes.filter((n: any) => n.inEdge);
    // Each node draws one circle; extra circles come from two mutually-exclusive overlays (see
    // backlog-graph.js): a batchable (Tier-A task / story ≤8) node adds ONE detached green outer ring
    // (`if (n.batchable)`), and a human-gated node adds TWO — a dashed "held" outer ring + a lock-badge
    // dot (`if (n.humanGate)` ×2). So circles = rendered-nodes + batchable rings + 2×human-gated.
    const batchableRings = rendered.filter((n: any) => n.batchable).length;
    const heldOverlays = rendered.filter((n: any) => n.humanGate).length * 2;
    expect(svg.querySelectorAll('circle').length).toBe(rendered.length + batchableRings + heldOverlays);
    // All edges connect two edge participants, so every edge renders in the All view.
    expect(svg.querySelectorAll('line').length).toBe(graph.edges.length);
  });

  it('sets a viewBox sized to the laid-out graph', () => {
    const svg = mount(graph);
    const vb = svg.getAttribute('viewBox');
    expect(vb).toMatch(/^0 0 \d+(\.\d+)? \d+(\.\d+)?$/);
  });

  it('links every rendered node to its backlog detail page', () => {
    const svg = mount(graph); // "all" view → one <a> per edge-participating node
    const rendered = graph.nodes.filter((n: any) => n.inEdge);
    const hrefs = Array.from(svg.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(hrefs.length).toBe(rendered.length);
    for (const n of rendered) expect(hrefs).toContain('/backlog/' + n.id + '/');
  });

  it('renders an arrowhead marker for directed edges', () => {
    const svg = mount(graph);
    expect(svg.querySelector('marker#bg-arrow')).toBeTruthy();
  });

  it('no-ops gracefully on an empty graph (draws nothing)', () => {
    const svg = mount({ nodes: [], edges: [], empty: true, maxLayer: 0 });
    expect(svg.querySelectorAll('circle').length).toBe(0);
    expect(svg.getAttribute('viewBox')).toBeNull();
  });
});
