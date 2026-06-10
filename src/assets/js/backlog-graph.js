// Backlog dependency relationship graph (#255). Data is computed at build time by
// src/_data/backlogGraph.js and embedded as JSON in #backlog-graph-data. This script lays the nodes
// out (layered by prerequisite depth, grouped into connected components) and draws an SVG — no chart
// library, the repo's native-first default. Nodes are coloured by agent-readiness tier, sized by how
// much work they unblock, and link to the item's detail page; edges point prerequisite → dependent.
//
// A filter toggle (#257) switches between two views over the SAME build-time model (no second graph):
//   • all   — every edge-participating item, including fully-resolved history.
//   • live  — "Open & blockers": only open/active nodes plus the still-open prerequisites gating them.
//             Since an unresolved prerequisite is itself open/active, "live" reduces to "status is
//             open or active", with edges kept only between two live nodes. Switching re-filters and
//             re-lays-out in place (no reload); the choice persists in localStorage.
(function () {
  'use strict';

  var dataEl = document.getElementById('backlog-graph-data');
  var svg = document.getElementById('backlog-graph');
  if (!dataEl || !svg) return;

  var graph;
  try { graph = JSON.parse(dataEl.textContent); } catch (e) { return; }
  if (!graph || graph.empty || !graph.nodes.length) return;

  var SVGNS = 'http://www.w3.org/2000/svg';
  var COL_W = 190;      // horizontal spacing per prerequisite layer
  var ROW_H = 58;       // vertical spacing per node within a layer
  var COMP_GAP = 36;    // gap between connected components
  var MARGIN = 32;
  var R_BASE = 13;      // node radius floor; grows with unblock count

  // Tier → fill/stroke. Mirrors the #249 chip palette; non-open items (no tier) render muted.
  var TIER = {
    A: { fill: '#dcfce7', stroke: '#16a34a', text: '#166534' },
    B: { fill: '#fef3c7', stroke: '#d97706', text: '#92400e' },
    C: { fill: '#f1f5f9', stroke: '#94a3b8', text: '#475569' },
  };
  var MUTED = { fill: '#f8fafc', stroke: '#cbd5e1', text: '#94a3b8' };      // resolved / parked
  var ACTIVE = { fill: '#dbeafe', stroke: '#2563eb', text: '#1e40af' };     // claimed / in progress
  var styleFor = function (n) {
    if (n.status === 'active') return ACTIVE;                               // claimed work stands out
    return (n.status === 'open' && TIER[n.tier]) ? TIER[n.tier] : MUTED;
  };
  var radiusFor = function (n) { return R_BASE + Math.min(10, n.chain * 2); };

  var make = function (tag, attrs) {
    var el = document.createElementNS(SVGNS, tag);
    Object.keys(attrs).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    return el;
  };

  // ── Filter (#257) ────────────────────────────────────────────────────────────
  // A node is "live" if its status is open or active. An unresolved prerequisite of a live node is
  // itself open/active, so this single predicate already captures the "open + still-open blockers"
  // semantic; resolved/parked chains drop out. Edges survive only between two live nodes.
  var FILTER_KEY = 'we-backlog-graph-filter';
  var isLive = function (n) { return n.status === 'open' || n.status === 'active'; };
  function subsetFor(mode) {
    if (mode !== 'live') {
      // "All" = the dependency network only (edge participants, incl. resolved history). The model now
      // also carries edge-free open items for the live view; keep them out of All so it stays the
      // lineage diagram and isn't flooded with standalone dots.
      var inEdge = graph.nodes.filter(function (n) { return n.inEdge; });
      return { nodes: inEdge, edges: graph.edges };
    }
    // "Open & blockers" = the COMPLETE open frontier: every open/active item. Those with live edges form
    // chains; those without (no blocker, or only resolved blockers) render as standalone nodes (a grid).
    var keep = {};
    graph.nodes.forEach(function (n) { if (isLive(n)) keep[n.num] = true; });
    var edges = graph.edges.filter(function (e) { return keep[e.from] && keep[e.to]; });
    return {
      nodes: graph.nodes.filter(function (n) { return keep[n.num]; }),
      edges: edges,
    };
  }

  var countEl = document.getElementById('bg-count');

  function render(mode) {
    var sub = subsetFor(mode);
    var nodes = sub.nodes, edges = sub.edges;

    // Clear any previous render so the toggle re-lays-out in place.
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    if (countEl) countEl.textContent = nodes.length + ' items';

    if (!nodes.length) {
      svg.setAttribute('viewBox', '0 0 360 60');
      svg.setAttribute('width', 360);
      svg.setAttribute('height', 60);
      var msg = make('text', { x: 16, y: 34, 'font-size': '13', fill: '#94a3b8' });
      msg.textContent = 'No open items in the dependency graph.';
      svg.appendChild(msg);
      return;
    }

    var byNum = {};
    nodes.forEach(function (n) { byNum[n.num] = n; });

    // ── Layers, recomputed over the CURRENT edge set ────────────────────────────
    // The build-time `n.layer` is the chain depth in the FULL graph. After filtering, a live node whose
    // prerequisites were all hidden would otherwise keep its old (deep) column and float disconnected. So
    // recompute depth from the visible edges: a node with no visible prerequisite is a left-column root.
    // (In "all" mode the visible set is the full set, so this reproduces the server layering.)
    var preds = {};
    nodes.forEach(function (n) { preds[n.num] = []; });
    edges.forEach(function (e) { if (preds[e.to] && byNum[e.from]) preds[e.to].push(e.from); });
    var layerCache = {};
    function layerOf(num, stack) {
      if (layerCache[num] != null) return layerCache[num];
      if (stack[num]) return 0;                 // cycle guard (validator forbids cycles)
      stack[num] = true;
      var L = 0;
      preds[num].forEach(function (p) { L = Math.max(L, 1 + layerOf(p, stack)); });
      stack[num] = false;
      layerCache[num] = L;
      return L;
    }
    nodes.forEach(function (n) { n._layer = layerOf(n.num, {}); });

    // ── Connected components (undirected over the edge set) ─────────────────────
    var adj = {};
    nodes.forEach(function (n) { adj[n.num] = []; });
    edges.forEach(function (e) {
      if (adj[e.from] && adj[e.to]) { adj[e.from].push(e.to); adj[e.to].push(e.from); }
    });
    var seen = {};
    var components = [];
    nodes.forEach(function (n) {
      if (seen[n.num]) return;
      var comp = [], queue = [n.num];
      seen[n.num] = true;
      while (queue.length) {
        var cur = queue.shift();
        comp.push(byNum[cur]);
        adj[cur].forEach(function (m) { if (!seen[m]) { seen[m] = true; queue.push(m); } });
      }
      components.push(comp);
    });
    // Largest / deepest components first so the busy ones sit at the top.
    components.sort(function (a, b) { return b.length - a.length || Number(a[0].num) - Number(b[0].num); });

    // Split chains (multi-node components) from standalone nodes (single-node components — an open item
    // with no live edge). Chains lay out left→right in bands; standalone nodes pack into a grid below.
    var chains = components.filter(function (c) { return c.length > 1; });
    var singles = components.filter(function (c) { return c.length === 1; }).map(function (c) { return c[0]; });
    singles.sort(function (a, b) { return Number(a.num) - Number(b.num); });

    // ── Layout: x by layer, y stacked per-layer within each component band ──────
    var yCursor = MARGIN;
    var maxX = 0;
    chains.forEach(function (comp) {
      var byLayer = {};
      comp.forEach(function (n) { (byLayer[n._layer] = byLayer[n._layer] || []).push(n); });
      var rows = 0;
      Object.keys(byLayer).forEach(function (L) {
        byLayer[L].sort(function (a, b) { return Number(a.num) - Number(b.num); });
        rows = Math.max(rows, byLayer[L].length);
        byLayer[L].forEach(function (n, i) {
          n._x = MARGIN + Number(L) * COL_W + R_BASE;
          n._y = yCursor + i * ROW_H + R_BASE;
          maxX = Math.max(maxX, n._x);
        });
      });
      yCursor += rows * ROW_H + COMP_GAP;
    });

    // Available pixel width of the scroll container, so the standalone grid fills the full panel width
    // instead of a fixed span. 0 when the Graph panel is still hidden at first render — we fall back to a
    // sane default and re-render once it becomes visible (see the ResizeObserver below).
    var availW = (svg.parentElement && svg.parentElement.clientWidth) || 0;
    var spanW = Math.max(maxX ? maxX + COL_W : 0, availW, 620);

    // ── Standalone grid: open items with no live dependency, packed compactly below the chains ──
    var GRID_CW = 56, GRID_RH = 48;          // minimum grid cell footprint (circle + gap)
    var divider = null;                       // {y, labelY} when a separator/label should be drawn
    if (singles.length) {
      var cols = Math.max(1, Math.floor((spanW - MARGIN * 2) / GRID_CW));
      var cellW = (spanW - MARGIN * 2) / cols;          // spread columns to fill the width → balanced L/R margins
      var gridTop = chains.length ? yCursor + 64 : MARGIN + 48;   // room for the header-sized label
      if (chains.length) divider = { y: yCursor + 10, labelY: yCursor + 34 };
      else divider = { y: 0, labelY: MARGIN + 18 };
      singles.forEach(function (n, i) {
        var col = i % cols, row = (i / cols) | 0;
        n._x = MARGIN + col * cellW + cellW / 2;        // centre node in its cell (don't grow maxX → no right gap)
        n._y = gridTop + row * GRID_RH + R_BASE;
      });
      yCursor = gridTop + Math.ceil(singles.length / cols) * GRID_RH;
    }

    var width = Math.max(maxX + COL_W, spanW);  // chains need label room (maxX+COL_W); grid fills spanW
    var height = yCursor + MARGIN;
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    svg.setAttribute('preserveAspectRatio', 'xMinYMin meet');
    // Render at natural 1:1 scale (units = px) so node/circle size is constant across filter modes —
    // a smaller live subset must not get upscaled to fill the panel. The container scrolls if wider.
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);

    // ── Render ────────────────────────────────────────────────────────────────
    // Arrowhead marker.
    var defs = make('defs', {});
    var marker = make('marker', { id: 'bg-arrow', viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '6', markerHeight: '6', orient: 'auto-start-reverse' });
    marker.appendChild(make('path', { d: 'M0,0 L10,5 L0,10 z', fill: '#94a3b8' }));
    defs.appendChild(marker);
    svg.appendChild(defs);

    // Divider + label introducing the standalone grid (live mode only, when there are singles).
    if (divider) {
      if (divider.y) svg.appendChild(make('line', {
        x1: MARGIN, y1: divider.y, x2: width - MARGIN, y2: divider.y,
        stroke: '#e2e8f0', 'stroke-width': '1', 'stroke-dasharray': '4 4',
      }));
      var cap = make('text', { x: MARGIN, y: divider.labelY, 'font-size': '15', 'font-weight': '700', fill: '#334155' });
      cap.textContent = 'No live dependencies — standalone open items (' + singles.length + ')';
      svg.appendChild(cap);
    }

    // Edges first (under nodes). Draw from prerequisite's right edge to dependent's left edge.
    edges.forEach(function (e) {
      var a = byNum[e.from], b = byNum[e.to];
      if (!a || !b) return;
      var ra = radiusFor(a), rb = radiusFor(b);
      svg.appendChild(make('line', {
        x1: a._x + ra, y1: a._y, x2: b._x - rb - 4, y2: b._y,
        stroke: '#cbd5e1', 'stroke-width': '1.5', 'marker-end': 'url(#bg-arrow)',
      }));
    });

    // Nodes: a link wrapping a circle + the #num label.
    nodes.forEach(function (n) {
      var st = styleFor(n), r = radiusFor(n);
      var link = make('a', { href: '/backlog/' + n.id + '/' });
      link.setAttribute('class', 'bg-node');
      var title = make('title', {});
      title.textContent = '#' + n.num + ' ' + n.title
        + '\nstatus: ' + n.status + (n.tier ? ' · tier ' + n.tier : '') + (n.batchable ? ' · batchable' : '')
        + '\nunblocks ' + n.direct + ' directly, ' + n.chain + ' in chain';
      link.appendChild(title);
      // Batchable (Tier-A task / story ≤5) nodes get a detached outer ring so the batch pool stands out.
      if (n.batchable) link.appendChild(make('circle', { cx: n._x, cy: n._y, r: r + 3.5, fill: 'none', stroke: '#16a34a', 'stroke-width': '1.5' }));
      link.appendChild(make('circle', { cx: n._x, cy: n._y, r: r, fill: st.fill, stroke: st.stroke, 'stroke-width': '2' }));
      var label = make('text', { x: n._x, y: n._y + 4, 'text-anchor': 'middle', 'font-size': '11', 'font-weight': '700', fill: st.text });
      label.textContent = n.num;
      link.appendChild(label);
      svg.appendChild(link);
    });
  }

  // ── Toggle wiring (default: live / "Open & blockers"), persisted in localStorage ──
  var filterBtns = Array.prototype.slice.call(document.querySelectorAll('[data-bg-filter]'));
  var mode = 'live';
  try { var saved = localStorage.getItem(FILTER_KEY); if (saved === 'all' || saved === 'live') mode = saved; } catch (e) { /* ignore */ }
  filterBtns.forEach(function (b) {
    b.classList.toggle('is-active', b.dataset.bgFilter === mode);
    b.addEventListener('click', function () {
      mode = b.dataset.bgFilter;
      filterBtns.forEach(function (x) { x.classList.toggle('is-active', x === b); });
      try { localStorage.setItem(FILTER_KEY, mode); } catch (e) { /* ignore */ }
      render(mode);
    });
  });

  // The Graph panel is hidden at first paint (container width 0), so the standalone grid can't size to
  // the real width yet. Re-render when the container gains/changes width (tab shown, window resized).
  if (typeof ResizeObserver === 'function' && svg.parentElement) {
    var lastW = 0;
    new ResizeObserver(function () {
      var w = (svg.parentElement && svg.parentElement.clientWidth) || 0;
      if (w && Math.abs(w - lastW) > 4) { lastW = w; render(mode); }
    }).observe(svg.parentElement);
  }

  render(mode);
})();
