/**
 * Web Charts conformance demo (#1293, slice of #1004) — the runnable proof of the `CustomChartRenderer`
 * contract (#1334) in a real browser, scoring the three conformance axes against the
 * `we:src/cases/webcharts/*` cases.
 *
 * The contract is type-only (`we:charts/contract.ts`); the native-first SVG renderer + every adapter +
 * the `customChartRenderers` swap registry are impl and live in FUI (`fui:charts/`, #1290/#1292). So,
 * like the webpositioning conformance demo's in-demo strategy, this demo supplies its **own** in-demo SVG
 * `CustomChartRenderer` — honest for a browser demo — to prove the contract is realizable: a semantic
 * `ChartSpec` + resolved theme tokens in, themed + accessible SVG out. The conformance section scores
 * each axis live; `setPlaygroundReady` reports the pass count the e2e smoke reads.
 */
import type {
  ChartSpec,
  CustomChartRenderer,
  ResolvedTheme,
  ChartHandle,
  PositionChannel,
  FieldChannel,
} from '/charts/contract.ts';
import { setPlaygroundReady } from '/demos/playground-harness';

const SVGNS = 'http://www.w3.org/2000/svg';
const W = 280;
const H = 180;

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

const title = (ch: PositionChannel | FieldChannel | undefined): string => {
  if (!ch) return '';
  const t = ch as PositionChannel & FieldChannel;
  return t.axis?.title ?? t.legend?.title ?? ch.field;
};

const ROLE_DESC: Record<ChartSpec['mark'], string> = {
  bar: 'bar chart', line: 'line chart', point: 'scatter plot', area: 'area chart', arc: 'pie chart',
};

/**
 * The in-demo SVG `CustomChartRenderer` — a compact conformant impl proving the contract is realizable.
 * Emits WAI-ARIA Graphics roles + a derived `<figure><table>` fallback; resolves `color` semantically
 * from the theme palette (never a spec hex).
 */
class DemoSvgRenderer implements CustomChartRenderer {
  readonly tier = 'L1' as const;

  readonly name = 'svg';

  render(spec: ChartSpec, theme: ResolvedTheme, target: Element): ChartHandle {
    let current = spec;
    const paint = (s: ChartSpec): void => { target.replaceChildren(this.#figure(s, theme)); };
    paint(spec);
    return {
      update: (next) => { current = next; paint(next); },
      destroy: () => target.replaceChildren(),
      describe: () => this.#describe(current),
    };
  }

  #describe(spec: ChartSpec): string {
    if (spec.description) return spec.description;
    const y = title(spec.encoding.y);
    const x = title(spec.encoding.x);
    return x && y ? `${y} by ${x}` : ROLE_DESC[spec.mark];
  }

  #figure(spec: ChartSpec, theme: ResolvedTheme): HTMLElement {
    const rows = spec.data.values ?? [];
    const label = this.#describe(spec);
    const fig = h('figure', { role: 'group', 'aria-label': label });
    fig.style.margin = '0';
    fig.append(this.#svg(spec, theme, rows, label), this.#table(spec, rows, label));
    return fig;
  }

  #svg(spec: ChartSpec, theme: ResolvedTheme, rows: Record<string, unknown>[], label: string): SVGSVGElement {
    const svg = svgEl('svg');
    svg.setAttribute('role', 'graphics-document');
    svg.setAttribute('aria-roledescription', ROLE_DESC[spec.mark]);
    svg.setAttribute('aria-label', label);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('width', '100%');

    const palette = theme.palette.length ? theme.palette : ['currentColor'];
    const xField = spec.encoding.x?.field;
    const yField = spec.encoding.y?.field;
    const colorField = spec.encoding.color?.field;
    const cats = xField ? rows.map((r) => String(r[xField])) : rows.map((_, i) => String(i));
    const vals = yField ? rows.map((r) => Number(r[yField]) || 0) : rows.map(() => 0);
    const max = Math.max(1, ...vals);
    const step = W / Math.max(rows.length, 1);
    const bw = step * 0.8;
    const fill = (i: number): string => (colorField ? palette[i % palette.length] : palette[0]);
    const dLabel = (i: number): string => `${cats[i]}: ${vals[i]}`;

    const g = svgEl('g');
    g.setAttribute('role', 'graphics-object');
    g.setAttribute('aria-label', title(spec.encoding.y) || 'series');

    if (spec.mark === 'line' || spec.mark === 'area') {
      const pts = rows.map((_, i) => [i * step + step / 2, H - (vals[i] / max) * H] as const);
      const poly = svgEl('polyline');
      poly.setAttribute('points', pts.map(([x, y]) => `${x},${y}`).join(' '));
      poly.setAttribute('fill', 'none');
      poly.setAttribute('stroke', palette[0]);
      poly.setAttribute('stroke-width', '2');
      g.append(poly);
      pts.forEach(([x, y], i) => {
        const dot = svgEl('circle');
        dot.setAttribute('role', 'graphics-symbol');
        dot.setAttribute('aria-label', dLabel(i));
        dot.setAttribute('cx', String(x));
        dot.setAttribute('cy', String(y));
        dot.setAttribute('r', '3');
        dot.setAttribute('fill', palette[0]);
        g.append(dot);
      });
    } else {
      rows.forEach((_, i) => {
        const bh = (vals[i] / max) * H;
        const rect = svgEl('rect');
        rect.setAttribute('role', 'graphics-symbol');
        rect.setAttribute('aria-label', dLabel(i));
        rect.setAttribute('x', String(i * step + (step - bw) / 2));
        rect.setAttribute('width', String(bw));
        rect.setAttribute('height', String(bh));
        rect.setAttribute('y', String(H - bh));
        rect.setAttribute('fill', fill(i));
        g.append(rect);
      });
    }
    svg.append(g);
    return svg;
  }

  #table(spec: ChartSpec, rows: Record<string, unknown>[], caption: string): HTMLTableElement {
    const cols: Array<PositionChannel | FieldChannel> = [];
    if (spec.encoding.x) cols.push(spec.encoding.x);
    if (spec.encoding.y) cols.push(spec.encoding.y);
    const table = h('table');
    table.append(h('caption', {}, caption));
    const head = h('tr');
    cols.forEach((c) => head.append(h('th', { scope: 'col' }, title(c))));
    table.append(h('thead', {}, head));
    const body = h('tbody');
    rows.forEach((row) => {
      const tr = h('tr');
      cols.forEach((c, ci) => {
        const cell = ci === 0 ? h('th', { scope: 'row' }) : h('td');
        cell.textContent = String(row[c.field] ?? '');
        tr.append(cell);
      });
      body.append(tr);
    });
    table.append(body);
    return table;
  }
}

// ── The four conformance-case ChartSpecs (transcribed from we:src/cases/webcharts/*) ──────────────────
const CASE_FIDELITY: ChartSpec = {
  data: { values: [{ quarter: 'Q1', revenue: 120 }, { quarter: 'Q2', revenue: 200 }, { quarter: 'Q3', revenue: 150 }] },
  mark: 'bar',
  encoding: {
    x: { field: 'quarter', type: 'nominal', axis: { title: 'Quarter' } },
    y: { field: 'revenue', type: 'quantitative', axis: { title: 'Revenue ($k)', grid: true } },
  },
};
const CASE_THEME: ChartSpec = {
  data: { values: [{ region: 'North', sales: 40 }, { region: 'South', sales: 60 }, { region: 'East', sales: 30 }] },
  mark: 'bar',
  encoding: {
    x: { field: 'region', type: 'nominal' },
    y: { field: 'sales', type: 'quantitative' },
    color: { field: 'region', type: 'nominal', legend: { title: 'Region' } },
  },
};
const CASE_A11Y: ChartSpec = {
  description: 'Quarterly revenue, rising from Q1 to Q2 then dipping in Q3.',
  data: { values: [{ quarter: 'Q1', revenue: 120 }, { quarter: 'Q2', revenue: 200 }, { quarter: 'Q3', revenue: 150 }] },
  mark: 'line',
  encoding: {
    x: { field: 'quarter', type: 'ordinal', axis: { title: 'Quarter' } },
    y: { field: 'revenue', type: 'quantitative', axis: { title: 'Revenue ($k)' } },
  },
};

const PALETTE = ['#2563eb', '#f59e0b', '#10b981'];
const renderer = new DemoSvgRenderer();

interface Check { axis: string; title: string; run: (host: HTMLElement) => boolean; }

function stage(host: HTMLElement): HTMLElement {
  const box = h('div', { class: 'wc-stage' });
  host.append(box);
  return box;
}

const CHECKS: Check[] = [
  {
    axis: 'semantic-fidelity',
    title: 'every data row maps to exactly one mark, in order, heights proportional to the value',
    run: (host) => {
      const box = stage(host);
      renderer.render(CASE_FIDELITY, { palette: PALETTE }, box);
      const bars = [...box.querySelectorAll('rect[role="graphics-symbol"]')];
      const heights = bars.map((b) => Number(b.getAttribute('height')));
      return bars.length === 3
        && heights[1] > heights[2] && heights[2] > heights[0]
        && Math.abs(heights[0] / heights[1] - 120 / 200) < 1e-6;
    },
  },
  {
    axis: 'theme-application',
    title: 'color is semantic — fills resolve from the theme palette in token order, no spec hex',
    run: (host) => {
      const box = stage(host);
      renderer.render(CASE_THEME, { palette: PALETTE }, box);
      const fills = [...box.querySelectorAll('rect[role="graphics-symbol"]')].map((r) => r.getAttribute('fill'));
      return JSON.stringify(fills) === JSON.stringify(PALETTE);
    },
  },
  {
    axis: 'theme-application',
    title: 're-themes from the same spec when the palette changes',
    run: (host) => {
      const box = stage(host);
      const alt = ['#aaa', '#bbb', '#ccc'];
      renderer.render(CASE_THEME, { palette: alt }, box);
      const fills = [...box.querySelectorAll('rect[role="graphics-symbol"]')].map((r) => r.getAttribute('fill'));
      return JSON.stringify(fills) === JSON.stringify(alt);
    },
  },
  {
    axis: 'accessibility',
    title: 'derives a labelled <figure><table> data fallback from the spec (caption, columns, rows)',
    run: (host) => {
      const box = stage(host);
      const handle = renderer.render(CASE_A11Y, { palette: PALETTE }, box);
      const fig = box.querySelector('figure[role="group"]');
      const caption = box.querySelector('table > caption')?.textContent;
      const cols = [...box.querySelectorAll('thead th')].map((t) => t.textContent);
      const bodyRows = box.querySelectorAll('tbody tr');
      const firstRow = bodyRows[0] ? [...bodyRows[0].children].map((c) => c.textContent) : [];
      return fig?.getAttribute('aria-label') === CASE_A11Y.description
        && caption === CASE_A11Y.description
        && JSON.stringify(cols) === JSON.stringify(['Quarter', 'Revenue ($k)'])
        && bodyRows.length === 3
        && JSON.stringify(firstRow) === JSON.stringify(['Q1', '120'])
        && handle.describe() === CASE_A11Y.description;
    },
  },
  {
    axis: 'accessibility',
    title: 'annotates SVG output with WAI-ARIA Graphics roles + labels derived from the encoding',
    run: (host) => {
      const box = stage(host);
      renderer.render(CASE_FIDELITY, { palette: PALETTE }, box);
      const svg = box.querySelector('svg[role="graphics-document"]');
      const object = svg?.querySelector('g[role="graphics-object"]');
      const symbols = object ? [...object.querySelectorAll('[role="graphics-symbol"]')] : [];
      return !!svg
        && svg.getAttribute('aria-roledescription') === 'bar chart'
        && !!object
        && symbols.length === 3
        && symbols[0].getAttribute('aria-label') === 'Q1: 120';
    },
  },
];

function mount(): void {
  const root = document.getElementById('play-root');
  if (!root) return;
  root.replaceChildren();

  // A visible gallery: each case rendered live with its label.
  const gallery = h('section', { class: 'wc-gallery' });
  for (const [label, spec] of [['Semantic fidelity', CASE_FIDELITY], ['Theme application', CASE_THEME], ['Accessibility', CASE_A11Y]] as const) {
    const card = h('figure', { class: 'wc-card' });
    const chart = h('div', { class: 'wc-chart' });
    renderer.render(spec, { palette: PALETTE }, chart);
    card.append(h('figcaption', {}, label), chart);
    gallery.append(card);
  }
  root.append(gallery);

  // The scored conformance section.
  const harness = h('div', { class: 'wc-stage-host' });
  harness.style.display = 'none';
  document.body.append(harness);

  const summary = h('section', { class: 'wc-summary' });
  const list = h('ul', { class: 'wc-checks' });
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
