/**
 * Data Table Playground — exercise the Data Table block's verified contract live.
 *
 * For each shared fixture it (1) shows the contract options, (2) renders the table through the
 * reference renderer, (3) shows the produced HTML, and (4) runs the SAME APG / Intl.Collator /
 * SQL-aggregate audit the CI conformance suite asserts — a green badge means the rendered table
 * satisfies the verified WAI-ARIA APG "Sortable Table" + comparison contract. Renderer, audit, and
 * fixtures are the one shared source, so the badges below and CI exercise the exact same code.
 * See /blocks/data-table/. Native DOM only.
 */
import { setPlaygroundReady } from '/demos/playground-harness';
import {
  renderDataTable,
  auditDataTable,
  applySortClick,
  announce,
  type AuditResult,
  type DataTableConfig,
  type Row,
} from '/blocks/renderers/data-table/renderDataTable';
import { dataTableCases, type DataTableCase } from '/blocks/renderers/data-table/__fixtures__/data-table-cases';

function el(tag: string, className?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function pane(label: string, content: Node): HTMLElement {
  const p = el('div', 'pane');
  p.append(el('div', 'pane-label', label));
  p.append(content);
  return p;
}

function contractLine(c: DataTableCase): string {
  const parts: string[] = [];
  if (c.config.sort && c.config.sort.by.length) {
    const k = c.config.sort.by[0];
    const opts = [k.numeric ? 'numeric' : '', k.sensitivity ? `sensitivity:${k.sensitivity}` : '', k.emptyPlacement ? `empty:${k.emptyPlacement}` : '']
      .filter(Boolean)
      .join(' ');
    parts.push(`sort:${c.config.sort.keys} ${k.field} ${k.direction}${opts ? '  ' + opts : ''}`);
  }
  if (c.config.filter) parts.push(`filter:${c.config.filter.match} (${c.config.filter.predicates.map((p) => p.label ?? '·').join(', ')})`);
  if (c.config.group) parts.push(`group:${c.config.group.field}  summary:${c.config.group.summary}`);
  parts.push(`order:${(c.config.order ?? ['filter', 'sort', 'group', 'page']).join('>')}`);
  return parts.join('  ·  ');
}

function checklist(result: AuditResult): HTMLElement {
  const ul = el('ul', 'checks');
  for (const ch of result.checks) {
    const li = el('li', ch.pass ? 'check pass' : 'check fail');
    li.textContent = `${ch.pass ? '✓' : '✗'} ${ch.label}`;
    ul.append(li);
  }
  return ul;
}

let passCount = 0;

function buildCard(c: DataTableCase): HTMLElement {
  const section = el('section', 'ex');
  const title = el('h2', 'ex-title');
  title.append(document.createTextNode(c.title + ' '));
  const badge = el('span', 'badge info', '…');
  title.append(badge);
  section.append(title);

  section.append(el('p', 'ex-contract', contractLine(c)));
  if (c.note) section.append(el('p', 'ex-note', c.note));

  const grid = el('div', 'ex-grid');
  section.append(grid);

  // Render the table + audit (the demo's whole point).
  const root = renderDataTable(c.rows, c.config);
  const result = auditDataTable(root, c.rows, c.config);
  if (result.ok) passCount++;

  badge.className = `badge ${result.ok ? 'pass' : 'fail'}`;
  badge.textContent = result.ok ? '✓ conformant' : '✗ contract violation';

  const live = el('div', 'preview');
  live.append(root);
  grid.append(pane('Live table', live));
  grid.append(pane('Produced HTML', el('pre', 'code', root.outerHTML)));
  grid.append(pane('Contract audit', checklist(result)));

  return section;
}

// ── Interactive (live) card — the interactivity axis (backlog #115) ──────────────
//
// Unlike the static fixture cards, this one is CLICKABLE: clicking a column header advances its sort
// (none → ascending → descending → none) and toggling the filter narrows the set. Each interaction
// re-runs the SAME shared renderer + audit (so the badge stays honest) and announces the new state
// through a polite aria-live region — exactly what a screen-reader user hears. The cycle + the
// announcement string come from the shared renderer (applySortClick / announce), so CI drives them too.

const PEOPLE: Row[] = [
  { name: 'Bianca', team: 'Engineering', salary: 120, location: 'Berlin' },
  { name: 'andré', team: 'Design', salary: 95, location: 'Lyon' },
  { name: 'Aaron', team: 'Engineering', salary: 110, location: 'Oslo' },
  { name: 'Chloé', team: 'Design', salary: 105, location: 'Paris' },
  { name: 'Dmitri', team: 'Engineering', salary: 90, location: 'Berlin' },
  { name: 'Émile', team: 'Sales', salary: 80, location: 'Lyon' },
];

const INTERACTIVE_COLUMNS = [
  { field: 'name', label: 'Name', sortable: true },
  { field: 'team', label: 'Team', sortable: true },
  { field: 'salary', label: 'Salary (k)', sortable: true },
  { field: 'location', label: 'Location' }, // non-sortable
];

const ENGINEERING_ONLY = {
  match: 'all' as const,
  predicates: [{ label: 'team = Engineering', test: (r: Row) => r.team === 'Engineering' }],
};

function buildInteractiveCard(): HTMLElement {
  const section = el('section', 'ex interactive');
  const title = el('h2', 'ex-title');
  title.append(document.createTextNode('9 · Live — click a header to sort, toggle the filter '));
  const badge = el('span', 'badge info', '…');
  title.append(badge);
  section.append(title);

  section.append(
    el(
      'p',
      'ex-note',
      'Clickable: header buttons cycle aria-sort none → ascending → descending → none, the filter narrows the set. Each interaction re-runs the shared audit (badge below) and announces the new state through the live region — the wiring CI also exercises.',
    ),
  );

  // Controls row: the filter toggle (sort is driven by the header buttons themselves).
  const controls = el('div', 'controls');
  const filterBtn = el('button', 'control-btn', 'Filter: Engineering only') as HTMLButtonElement;
  filterBtn.type = 'button';
  filterBtn.setAttribute('aria-pressed', 'false');
  controls.append(filterBtn);
  section.append(controls);

  // The polite live region — empty until the first interaction so load doesn't announce.
  const liveRegion = el('p', 'live-region');
  liveRegion.setAttribute('role', 'status');
  liveRegion.setAttribute('aria-live', 'polite');
  section.append(liveRegion);

  const grid = el('div', 'ex-grid');
  section.append(grid);
  const live = el('div', 'preview');
  const checksPane = el('div');
  grid.append(pane('Live table', live));
  grid.append(pane('Contract audit', checksPane));

  // Mutable state: start sorted by name ascending, unfiltered.
  let config: DataTableConfig = {
    columns: INTERACTIVE_COLUMNS,
    sort: { keys: 'single', by: [{ field: 'name', direction: 'ascending' }] },
  };

  // (Re)render the table + audit from the current config. Does NOT announce (interactions do).
  // `countInitial` lets the very first paint contribute to the playground's pass tally, like the
  // static cards; later re-renders only refresh the badge.
  function render(countInitial = false): void {
    const root = renderDataTable(PEOPLE, config);
    const result = auditDataTable(root, PEOPLE, config);
    if (countInitial && result.ok) passCount++;
    badge.className = `badge ${result.ok ? 'pass' : 'fail'}`;
    badge.textContent = result.ok ? '✓ conformant' : '✗ contract violation';
    live.replaceChildren(root);
    checksPane.replaceChildren(checklist(result));
  }

  // Click-to-sort: a delegated listener catches the header buttons (data-action="sort").
  live.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('button[data-action="sort"]');
    if (!btn) return;
    const field = btn.getAttribute('data-field');
    if (!field) return;
    config = applySortClick(config, field);
    render();
    liveRegion.textContent = announce(PEOPLE, config);
  });

  // Filter toggle: flips the Engineering-only predicate, re-audits, announces the narrowed count.
  filterBtn.addEventListener('click', () => {
    const on = filterBtn.getAttribute('aria-pressed') === 'true';
    const { filter: _drop, ...rest } = config;
    config = on ? rest : { ...rest, filter: ENGINEERING_ONLY };
    filterBtn.setAttribute('aria-pressed', String(!on));
    render();
    liveRegion.textContent = announce(PEOPLE, config);
  });

  render(true); // initial paint (badge green, counts toward the tally); no announcement yet
  return section;
}

const host = document.getElementById('examples');
if (host) {
  const summary = el('div', 'summary', '');
  const cards = dataTableCases.map(buildCard);
  const interactive = buildInteractiveCard(); // bumps passCount on its initial green render
  const total = dataTableCases.length + 1; // + the live interactive card
  host.replaceChildren(summary, ...cards, interactive);
  summary.className = `summary ${passCount === total ? 'pass' : 'fail'}`;
  summary.textContent = `${passCount}/${total} cases satisfy the verified data-table contract`;
}

setPlaygroundReady(passCount);
