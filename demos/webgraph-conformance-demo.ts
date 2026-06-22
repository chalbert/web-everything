/**
 * Web Graph conformance demo (#1446, slice of #1289) — the runnable proof of the webgraph contract
 * (`we:graphs/contract.ts`, #1443) in a real browser, scoring the three ratified axes against the
 * `we:src/cases/webgraph/*` cases: semantic fidelity, theme application, accessibility.
 *
 * The contract is type-only; the native-first deterministic layered-DAG layout (#1444) + the SVG renderer
 * (#1445) + every adapter + the swap registries are impl and live in FUI (`fui:graphs/`, #1290). So — like
 * the webcharts conformance demo — this demo supplies its **own** in-demo `CustomGraphLayout` +
 * `CustomGraphRenderer` (honest for a browser demo) to prove the contract is realizable end-to-end: a
 * semantic `GraphSpec` in → layout invents coordinates (`PositionedGraph`) → renderer draws themed +
 * accessible SVG out.
 *
 * Note on the split seam: `CustomGraphRenderer.render(positioned, theme, target)` receives COORDINATES
 * only (the #1352 two-seam split), so the in-demo renderer joins each `PositionedNode` back to the
 * `GraphSpec` **by id** for the semantic plane (label / kind / weight) it needs to resolve theme tokens
 * and derive the a11y adjacency table — which case 03 specifies is "derived mechanically from the spec".
 * The conformance section scores each axis live; `setPlaygroundReady` reports the pass count the e2e smoke reads.
 */
import type {
  GraphSpec,
  GraphNodeSpec,
  CustomGraphLayout,
  CustomGraphRenderer,
  PositionedGraph,
  ResolvedTheme,
  GraphHandle,
} from '/graphs/contract.ts';
import { setPlaygroundReady } from '/demos/playground-harness';

/** The a11y case carries an optional spec-level description (the contract leaves description derivable). */
type DemoGraphSpec = GraphSpec & { description?: string };

const SVGNS = 'http://www.w3.org/2000/svg';
const XGAP = 120;
const YGAP = 90;

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const c of children) node.append(c);
  return node;
}

function svgEl<K extends keyof SVGElementTagNameMap>(name: K): SVGElementTagNameMap[K] {
  return document.createElementNS(SVGNS, name);
}

/**
 * In-demo deterministic layered-DAG layout — `GraphSpec` → coordinates only. A node's layer is the
 * longest incoming path from a root (a source with no incoming edge), so a source sits ABOVE its target
 * (the #1444 columnar DAG ordering); x is the node's index within its layer, in spec order. Deterministic:
 * the same spec always yields the same coordinates (a cycle guard keeps it total).
 */
class DemoLayeredLayout implements CustomGraphLayout {
  readonly strategy = 'layered' as const;
  readonly deterministic = true;

  layout(spec: GraphSpec): PositionedGraph {
    const preds = new Map<string, string[]>();
    for (const n of spec.nodes) preds.set(n.id, []);
    for (const e of spec.edges) preds.get(e.to)?.push(e.from);

    const memo = new Map<string, number>();
    const layerOf = (id: string, stack: Set<string>): number => {
      const cached = memo.get(id);
      if (cached !== undefined) return cached;
      if (stack.has(id)) return 0; // cycle guard — keep the function total
      stack.add(id);
      const ps = preds.get(id) ?? [];
      const layer = ps.length ? Math.max(...ps.map((p) => layerOf(p, stack) + 1)) : 0;
      stack.delete(id);
      memo.set(id, layer);
      return layer;
    };

    const byLayer = new Map<number, GraphNodeSpec[]>();
    for (const n of spec.nodes) {
      const l = layerOf(n.id, new Set());
      (byLayer.get(l) ?? byLayer.set(l, []).get(l)!).push(n);
    }

    const pos = new Map<string, { x: number; y: number }>();
    let maxRow = 0;
    for (const [layer, nodes] of byLayer) {
      maxRow = Math.max(maxRow, nodes.length);
      nodes.forEach((n, i) => pos.set(n.id, { x: i * XGAP + XGAP / 2, y: layer * YGAP + YGAP / 2 }));
    }

    return {
      nodes: spec.nodes.map((n) => ({ id: n.id, ...pos.get(n.id)!, width: 16, height: 16 })),
      edges: spec.edges.map((e) => ({ from: e.from, to: e.to })),
      bounds: { width: maxRow * XGAP, height: (byLayer.size) * YGAP },
    };
  }
}

/**
 * In-demo SVG renderer — coordinates + resolved theme in, themed + accessible SVG out. Joins each
 * `PositionedNode` back to the construction `GraphSpec` by id for the semantic plane: node `kind` →
 * categorical palette token (never a spec hex), edge `weight` → stroke scale from `edgeWeightRange`, and
 * the WAI-ARIA Graphics roles + the derived `<figure><table>` adjacency fallback + `describe()`.
 */
class DemoSvgGraphRenderer implements CustomGraphRenderer {
  readonly #spec: DemoGraphSpec;
  constructor(spec: DemoGraphSpec) {
    this.#spec = spec;
  }

  /** Distinct node `kind`s in first-appearance order → palette index (semantic, not a spec literal). */
  #kindOrder(): string[] {
    const order: string[] = [];
    for (const n of this.#spec.nodes) {
      const k = n.kind ?? '';
      if (!order.includes(k)) order.push(k);
    }
    return order;
  }

  render(positioned: PositionedGraph, theme: ResolvedTheme, target: Element): GraphHandle {
    target.replaceChildren(this.#figure(positioned, theme));
    return {
      update: (next) => target.replaceChildren(this.#figure(next, theme)),
      destroy: () => target.replaceChildren(),
      describe: () => this.#describe(),
    };
  }

  #describe(): string {
    if (this.#spec.description) return this.#spec.description;
    const n = this.#spec.nodes.length;
    const e = this.#spec.edges.length;
    return `A graph of ${n} node${n === 1 ? '' : 's'} and ${e} edge${e === 1 ? '' : 's'}.`;
  }

  #label(id: string): string {
    return this.#spec.nodes.find((n) => n.id === id)?.label ?? id;
  }

  #figure(positioned: PositionedGraph, theme: ResolvedTheme): HTMLElement {
    const desc = this.#describe();
    const fig = h('figure', { role: 'group', 'aria-label': desc });
    fig.style.margin = '0';
    fig.append(this.#svg(positioned, theme, desc), this.#table(desc));
    return fig;
  }

  #svg(positioned: PositionedGraph, theme: ResolvedTheme, label: string): SVGSVGElement {
    const svg = svgEl('svg');
    svg.setAttribute('role', 'graphics-document');
    svg.setAttribute('aria-roledescription', 'graph');
    svg.setAttribute('aria-label', label);
    const { width, height } = positioned.bounds;
    svg.setAttribute('viewBox', `0 0 ${Math.max(width, XGAP)} ${Math.max(height, YGAP)}`);
    svg.setAttribute('width', '100%');

    const palette = theme.palette.length ? theme.palette : ['currentColor'];
    const kinds = this.#kindOrder();
    const [wMin, wMax] = theme.edgeWeightRange ?? [1, 4];
    const weights = this.#spec.edges.map((e) => e.weight ?? 0);
    const wMaxVal = Math.max(1, ...weights);
    const at = new Map(positioned.nodes.map((n) => [n.id, n]));

    // Edges first (under the nodes). stroke-width resolves from the semantic weight, never a literal.
    const edgesG = svgEl('g');
    edgesG.setAttribute('role', 'graphics-object');
    edgesG.setAttribute('aria-label', 'edges');
    positioned.edges.forEach((pe, i) => {
      const a = at.get(pe.from);
      const b = at.get(pe.to);
      if (!a || !b) return;
      const line = svgEl('line');
      line.setAttribute('role', 'graphics-symbol');
      const spec = this.#spec.edges[i];
      line.setAttribute('aria-label', `${this.#label(pe.from)} → ${this.#label(pe.to)}${spec?.kind ? ` (${spec.kind})` : ''}`);
      line.setAttribute('x1', String(a.x));
      line.setAttribute('y1', String(a.y));
      line.setAttribute('x2', String(b.x));
      line.setAttribute('y2', String(b.y));
      line.setAttribute('stroke', 'currentColor');
      const w = weights[i] ? wMin + (weights[i] / wMaxVal) * (wMax - wMin) : wMin;
      line.setAttribute('stroke-width', String(w));
      edgesG.append(line);
    });
    svg.append(edgesG);

    // Nodes: one mark per node, fill resolved from the palette by kind (semantic, in token order).
    const nodesG = svgEl('g');
    nodesG.setAttribute('role', 'graphics-object');
    nodesG.setAttribute('aria-label', 'nodes');
    for (const pn of positioned.nodes) {
      const spec = this.#spec.nodes.find((n) => n.id === pn.id);
      const kindIdx = Math.max(0, kinds.indexOf(spec?.kind ?? ''));
      const circle = svgEl('circle');
      circle.setAttribute('role', 'graphics-symbol');
      circle.setAttribute('aria-label', this.#label(pn.id));
      circle.setAttribute('cx', String(pn.x));
      circle.setAttribute('cy', String(pn.y));
      circle.setAttribute('r', '8');
      circle.setAttribute('fill', palette[kindIdx % palette.length]);
      nodesG.append(circle);
    }
    svg.append(nodesG);
    return svg;
  }

  /** The tier-1 a11y floor: a per-node adjacency table derived mechanically from the spec. */
  #table(caption: string): HTMLTableElement {
    const table = h('table');
    table.append(h('caption', {}, caption));
    const head = h('tr');
    head.append(h('th', { scope: 'col' }, 'Node'), h('th', { scope: 'col' }, 'Connects to'));
    table.append(h('thead', {}, head));
    const body = h('tbody');
    for (const n of this.#spec.nodes) {
      const outgoing = this.#spec.edges.filter((e) => e.from === n.id);
      const adj = outgoing.length
        ? outgoing.map((e) => `${this.#label(e.to)}${e.kind ? ` (${e.kind})` : ''}`).join(', ')
        : '—';
      const tr = h('tr');
      tr.append(h('th', { scope: 'row' }, n.label ?? n.id), h('td', {}, adj));
      body.append(tr);
    }
    table.append(body);
    return table;
  }
}

// ── The three conformance-case GraphSpecs (transcribed from we:src/cases/webgraph/*) ──────────────────
const CASE_FIDELITY: DemoGraphSpec = {
  directed: true,
  layout: 'layered',
  nodes: [
    { id: 'webeverything', label: 'Web Everything', kind: 'standard' },
    { id: 'frontierui', label: 'Frontier UI', kind: 'impl' },
    { id: 'plateau', label: 'Plateau', kind: 'product' },
  ],
  edges: [
    { from: 'frontierui', to: 'webeverything', kind: 'implements' },
    { from: 'plateau', to: 'frontierui', kind: 'consumes' },
  ],
};
const CASE_THEME: DemoGraphSpec = {
  directed: true,
  layout: 'layered',
  nodes: [
    { id: 'a', label: 'Service A', kind: 'primary' },
    { id: 'b', label: 'Service B', kind: 'secondary' },
  ],
  edges: [{ from: 'a', to: 'b', kind: 'depends-on', weight: 3 }],
};
const CASE_A11Y: DemoGraphSpec = {
  description: 'The constellation: Frontier UI implements Web Everything; Plateau consumes Frontier UI.',
  directed: true,
  layout: 'layered',
  nodes: [
    { id: 'webeverything', label: 'Web Everything' },
    { id: 'frontierui', label: 'Frontier UI' },
    { id: 'plateau', label: 'Plateau' },
  ],
  edges: [
    { from: 'frontierui', to: 'webeverything', kind: 'implements' },
    { from: 'plateau', to: 'frontierui', kind: 'consumes' },
  ],
};

const PALETTE = ['#2563eb', '#f59e0b', '#10b981'];
const layout = new DemoLayeredLayout();

interface Check { axis: string; title: string; run: (host: HTMLElement) => boolean; }

function stage(host: HTMLElement): HTMLElement {
  const box = h('div', { class: 'wg-stage' });
  host.append(box);
  return box;
}

const CHECKS: Check[] = [
  {
    axis: 'semantic-fidelity',
    title: 'every node → one mark and every edge → one link between its declared endpoints, in spec order',
    run: (host) => {
      const box = stage(host);
      const positioned = layout.layout(CASE_FIDELITY);
      new DemoSvgGraphRenderer(CASE_FIDELITY).render(positioned, { palette: PALETTE }, box);
      const nodes = [...box.querySelectorAll('circle[role="graphics-symbol"]')];
      const edges = [...box.querySelectorAll('line[role="graphics-symbol"]')];
      return nodes.length === 3 && edges.length === 2
        && edges[0].getAttribute('aria-label') === 'Frontier UI → Web Everything (implements)'
        && edges[1].getAttribute('aria-label') === 'Plateau → Frontier UI (consumes)';
    },
  },
  {
    axis: 'semantic-fidelity',
    title: 'the layered layout places a source above its target (deterministic DAG column ordering)',
    run: () => {
      const p = layout.layout(CASE_FIDELITY);
      const y = (id: string) => p.nodes.find((n) => n.id === id)!.y;
      // plateau → frontierui → webeverything : each source strictly above its target.
      const monotone = y('plateau') < y('frontierui') && y('frontierui') < y('webeverything');
      // deterministic: identical input yields identical coordinates.
      const p2 = layout.layout(CASE_FIDELITY);
      return monotone && JSON.stringify(p.nodes) === JSON.stringify(p2.nodes);
    },
  },
  {
    axis: 'theme-application',
    title: 'node fill resolves from the theme palette keyed by kind — distinct kinds, distinct tokens, no spec hex',
    run: (host) => {
      const box = stage(host);
      new DemoSvgGraphRenderer(CASE_FIDELITY).render(layout.layout(CASE_FIDELITY), { palette: PALETTE }, box);
      const fills = [...box.querySelectorAll('circle[role="graphics-symbol"]')].map((c) => c.getAttribute('fill'));
      // three distinct kinds (standard/impl/product) → the three palette tokens in order.
      return JSON.stringify(fills) === JSON.stringify(PALETTE);
    },
  },
  {
    axis: 'theme-application',
    title: 're-themes from the same spec when the palette changes; edge weight resolves a stroke scale',
    run: (host) => {
      const box = stage(host);
      const alt = ['#aaa', '#bbb', '#ccc'];
      new DemoSvgGraphRenderer(CASE_THEME).render(layout.layout(CASE_THEME), { palette: alt, edgeWeightRange: [1, 6] }, box);
      const fills = [...box.querySelectorAll('circle[role="graphics-symbol"]')].map((c) => c.getAttribute('fill'));
      const stroke = Number(box.querySelector('line[role="graphics-symbol"]')?.getAttribute('stroke-width'));
      // primary→alt[0], secondary→alt[1]; the single weighted edge resolves into the [1,6] scale (not a literal px).
      return JSON.stringify(fills) === JSON.stringify(['#aaa', '#bbb']) && stroke > 1 && stroke <= 6;
    },
  },
  {
    axis: 'accessibility',
    title: 'derives a labelled <figure><table> adjacency fallback from the spec (caption, columns, per-node rows)',
    run: (host) => {
      const box = stage(host);
      const handle = new DemoSvgGraphRenderer(CASE_A11Y).render(layout.layout(CASE_A11Y), { palette: PALETTE }, box);
      const fig = box.querySelector('figure[role="group"]');
      const caption = box.querySelector('table > caption')?.textContent;
      const cols = [...box.querySelectorAll('thead th')].map((t) => t.textContent);
      const rows = [...box.querySelectorAll('tbody tr')].map((tr) => [...tr.children].map((c) => c.textContent));
      return fig?.getAttribute('aria-label') === CASE_A11Y.description
        && caption === CASE_A11Y.description
        && JSON.stringify(cols) === JSON.stringify(['Node', 'Connects to'])
        && JSON.stringify(rows) === JSON.stringify([
          ['Web Everything', '—'],
          ['Frontier UI', 'Web Everything (implements)'],
          ['Plateau', 'Frontier UI (consumes)'],
        ])
        && handle.describe() === CASE_A11Y.description;
    },
  },
  {
    axis: 'accessibility',
    title: 'annotates SVG output with WAI-ARIA Graphics roles + labels derived from node/edge semantics',
    run: (host) => {
      const box = stage(host);
      new DemoSvgGraphRenderer(CASE_FIDELITY).render(layout.layout(CASE_FIDELITY), { palette: PALETTE }, box);
      const svg = box.querySelector('svg[role="graphics-document"]');
      const objects = svg ? [...svg.querySelectorAll('g[role="graphics-object"]')] : [];
      const node0 = svg?.querySelector('circle[role="graphics-symbol"]');
      return !!svg
        && svg.getAttribute('aria-roledescription') === 'graph'
        && objects.length === 2
        && node0?.getAttribute('aria-label') === 'Web Everything';
    },
  },
];

function mount(): void {
  const root = document.getElementById('play-root');
  if (!root) return;
  root.replaceChildren();

  // A visible gallery: each case rendered live with its label.
  const gallery = h('section', { class: 'wg-gallery' });
  for (const [label, spec] of [['Semantic fidelity', CASE_FIDELITY], ['Theme application', CASE_THEME], ['Accessibility', CASE_A11Y]] as const) {
    const card = h('figure', { class: 'wg-card' });
    const graph = h('div', { class: 'wg-graph' });
    new DemoSvgGraphRenderer(spec).render(layout.layout(spec), { palette: PALETTE, edgeWeightRange: [1, 6] }, graph);
    card.append(h('figcaption', {}, label), graph);
    gallery.append(card);
  }
  root.append(gallery);

  // The scored conformance section.
  const harness = h('div', { class: 'wg-stage-host' });
  harness.style.display = 'none';
  document.body.append(harness);

  const summary = h('section', { class: 'wg-summary' });
  const list = h('ul', { class: 'wg-checks' });
  let pass = 0;
  for (const check of CHECKS) {
    let ok = false;
    try { ok = check.run(harness); } catch { ok = false; }
    if (ok) pass += 1;
    list.append(h('li', { class: ok ? 'pass' : 'fail', 'data-axis': check.axis },
      `${ok ? '✓' : '✗'} [${check.axis}] ${check.title}`));
  }
  summary.append(
    h('h2', {}, `Contract conformance — ${pass} / ${CHECKS.length} checks pass`),
    list,
  );
  root.append(summary);
  harness.remove();

  setPlaygroundReady(pass);
}

mount();
