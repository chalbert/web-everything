/**
 * Data Grid Playground — exercise the Data Grid block's verified APG Data Grid contract live.
 *
 * For each shared fixture it (1) shows the key sequence, (2) renders the grid AT the cell that
 * sequence lands on (via the same movement engine), (3) shows the produced HTML, and (4) runs the
 * SAME audit the CI conformance suite asserts — a green badge means the grid satisfies the verified
 * WAI-ARIA APG "Data Grid" structure + roving-tabindex contract. The last card is LIVE: click into
 * the grid and use the arrow keys / Home / End / Ctrl+Home / Ctrl+End / PageUp / PageDown to move
 * real DOM focus cell to cell; each move re-runs the shared audit so the badge stays honest.
 * Renderer, audit, movement engine, and fixtures are the one shared source, so the badges below and
 * CI exercise the exact same code. See /blocks/data-grid/. Native DOM only.
 */
import { setPlaygroundReady } from '/demos/playground-harness';
import {
  renderDataGrid,
  auditDataGrid,
  nextCellPosition,
  dimensionsOf,
  ORIGIN,
  type AuditResult,
  type CellPosition,
  type DataGridConfig,
  type KeyInput,
  type Row,
} from '/blocks/renderers/data-grid/renderDataGrid';
import DataGridBehavior, {
  type GridCellChangeDetail,
} from '/blocks/data-grid/DataGridBehavior';
import { dataGridCases, type DataGridCase } from '/blocks/renderers/data-grid/__fixtures__/data-grid-cases';

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

/** Render a key sequence as a readable trace: "Origin → ArrowDown → End → (1,3)". */
function keyTrace(c: DataGridCase): string {
  const fmt = (k: KeyInput) => ((k.ctrlKey || k.metaKey) ? 'Ctrl+' : '') + k.key;
  const seq = c.keys.length ? c.keys.map(fmt).join(' → ') : '(no keys)';
  return `Origin → ${seq} → focus (${c.expected.row}, ${c.expected.col})`;
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

function buildCard(c: DataGridCase): HTMLElement {
  const section = el('section', 'ex');
  const title = el('h2', 'ex-title');
  title.append(document.createTextNode(c.title + ' '));
  const badge = el('span', 'badge info', '…');
  title.append(badge);
  section.append(title);

  section.append(el('p', 'ex-contract', keyTrace(c)));
  if (c.note) section.append(el('p', 'ex-note', c.note));

  const grid = el('div', 'ex-grid');
  section.append(grid);

  // Fold the keys through the shared movement engine, render the grid at the landing cell, audit.
  const landed = c.keys.reduce(
    (pos, key) => nextCellPosition(pos, key, dimensionsOf(c.rows, c.config), c.config.pageSize),
    ORIGIN,
  );
  const root = renderDataGrid(c.rows, c.config, landed);
  const result = auditDataGrid(root, c.rows, c.config, landed);
  if (result.ok) passCount++;

  badge.className = `badge ${result.ok ? 'pass' : 'fail'}`;
  badge.textContent = result.ok ? '✓ conformant' : '✗ contract violation';

  const live = el('div', 'preview');
  live.append(root);
  grid.append(pane('Grid (focused cell highlighted)', live));
  grid.append(pane('Produced HTML', el('pre', 'code', root.outerHTML)));
  grid.append(pane('Contract audit', checklist(result)));

  return section;
}

// ── Interactive (live) card — driven by the real DataGridBehavior ────────────────
//
// Unlike the static fixture cards, this grid is FOCUSABLE — and the wiring is no longer inline: it
// attaches the production `grid:cell-navigation` behavior (DataGridBehavior). Click any cell (or tab
// in to the roving tabindex="0" cell) and the arrow keys, Home/End, Ctrl+Home/End, and PageUp/Down
// move real DOM focus cell to cell — keydown handling, the roving tabindex, focus, and scroll-into-view
// are all the behavior's job now. It emits `grid-cell-change` on every move; this card just listens,
// updates the read-out, and re-runs the SAME audit CI asserts so the badge stays honest. The "wrap at
// edges" toggle flips the behavior's opt-in Focus-Delegation `wrap` (last → first instead of clamping).

const PEOPLE: Row[] = [
  { name: 'Bianca', team: 'Engineering', salary: 120, location: 'Berlin' },
  { name: 'André', team: 'Design', salary: 95, location: 'Lyon' },
  { name: 'Aaron', team: 'Engineering', salary: 110, location: 'Oslo' },
  { name: 'Chloé', team: 'Design', salary: 105, location: 'Paris' },
  { name: 'Dmitri', team: 'Engineering', salary: 90, location: 'Berlin' },
  { name: 'Émile', team: 'Sales', salary: 80, location: 'Lyon' },
];

const INTERACTIVE_CONFIG: DataGridConfig = {
  columns: [
    { field: 'name', label: 'Name' },
    { field: 'team', label: 'Team' },
    { field: 'salary', label: 'Salary (k)' },
    { field: 'location', label: 'Location' },
  ],
};

function buildInteractiveCard(): HTMLElement {
  const section = el('section', 'ex interactive');
  const title = el('h2', 'ex-title');
  title.append(document.createTextNode(`${dataGridCases.length + 1} · Live — driven by the real grid:cell-navigation behavior `));
  const badge = el('span', 'badge info', '…');
  title.append(badge);
  section.append(title);

  section.append(
    el(
      'p',
      'ex-note',
      'Focusable, and wired by the production DataGridBehavior — not inline demo code: click a cell or Tab into the grid, then ArrowUp/Down/Left/Right move one cell, Home/End jump to the row ends, Ctrl+Home/Ctrl+End to the grid corners, and PageUp/PageDown by a page (5 rows). The behavior owns keydown, the roving tabindex, real DOM focus, and scroll-into-view; it emits grid-cell-change, and this card just re-runs the shared audit (badge below) — the model CI also drives.',
    ),
  );

  // Opt-in wrap toggle — flips the behavior's Focus-Delegation `wrap` (last → first vs. clamp).
  const wrapLabel = el('label', 'wrap-toggle');
  const wrapToggle = document.createElement('input');
  wrapToggle.type = 'checkbox';
  wrapLabel.append(wrapToggle, document.createTextNode(' Wrap at edges (arrow past the edge → opposite edge)'));
  section.append(wrapLabel);

  // A read-out of the current cell so you can SEE where focus is.
  const readout = el('p', 'live-region');
  readout.setAttribute('role', 'status');
  readout.setAttribute('aria-live', 'polite');
  section.append(readout);

  const grid = el('div', 'ex-grid');
  section.append(grid);
  const live = el('div', 'preview');
  const checksPane = el('div');
  grid.append(pane('Live grid', live));
  grid.append(pane('Contract audit', checksPane));

  const root = renderDataGrid(PEOPLE, INTERACTIVE_CONFIG, ORIGIN);
  root.setAttribute('grid:cell-navigation', ''); // the attribute the behavior keys off
  live.append(root);

  // Attach the production behavior exactly as the bootstrap / a real app would (manual upgrade here,
  // mirroring the unit test) — from this point the grid navigates itself.
  const behavior = new DataGridBehavior({ name: 'grid:cell-navigation' });
  behavior.attach(root);
  behavior.isConnected = true;
  behavior.connectedCallback();

  wrapToggle.addEventListener('change', () => {
    root.setAttribute('grid:cell-navigation', wrapToggle.checked ? 'wrap' : '');
  });

  function describe(pos: CellPosition): string {
    const which = pos.row === 0 ? `header “${INTERACTIVE_CONFIG.columns[pos.col].label}”` : `cell row ${pos.row}, ${INTERACTIVE_CONFIG.columns[pos.col].label}`;
    const cell = root.querySelector(`[data-row="${pos.row}"][data-col="${pos.col}"]`);
    return `Focus: ${which} — “${cell?.textContent ?? ''}”`;
  }

  function audit(countInitial = false): void {
    const result = auditDataGrid(root, PEOPLE, INTERACTIVE_CONFIG, behavior.active);
    if (countInitial && result.ok) passCount++;
    badge.className = `badge ${result.ok ? 'pass' : 'fail'}`;
    badge.textContent = result.ok ? '✓ conformant' : '✗ contract violation';
    checksPane.replaceChildren(checklist(result));
  }

  // The behavior is the single source of movement; the card just reacts to its announcements.
  root.addEventListener('grid-cell-change', (e) => {
    const { to } = (e as CustomEvent<GridCellChangeDetail>).detail;
    readout.textContent = describe(to);
    audit();
  });

  readout.textContent = describe(behavior.active);
  audit(true); // initial paint counts toward the tally, like the static cards
  return section;
}

const host = document.getElementById('examples');
if (host) {
  const summary = el('div', 'summary', '');
  const cards = dataGridCases.map(buildCard);
  const interactive = buildInteractiveCard(); // bumps passCount on its initial green audit
  const total = dataGridCases.length + 1; // + the live interactive card
  host.replaceChildren(summary, ...cards, interactive);
  summary.className = `summary ${passCount === total ? 'pass' : 'fail'}`;
  summary.textContent = `${passCount}/${total} cases satisfy the verified data-grid contract`;
}

setPlaygroundReady(passCount);
