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
import DataGridEditBehavior from '/blocks/data-grid/DataGridEditBehavior';
import {
  auditEditableGrid,
  type GridCellEditCommitDetail,
  type GridCellEditDetail,
} from '/blocks/renderers/data-grid/editableGrid';
import { dataGridCases, type DataGridCase } from '/blocks/renderers/data-grid/__fixtures__/data-grid-cases';
import {
  editableCases,
  type EditableCase,
  type EditStep,
} from '/blocks/renderers/data-grid/__fixtures__/editable-grid-cases';

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

// ── Editable cells (grid:cell-edit) — the APG editable sub-pattern over the navigation grid ──────
//
// These cards exercise the SECOND behavior, grid:cell-edit (DataGridEditBehavior), layered on the same
// grid as grid:cell-navigation. Each replay card seeds focus on a cell, replays a key/typing script
// through BOTH real behaviors, and runs the shared auditEditableGrid — green means the mode model holds
// (editor on the right data cell, never a header; or no editor when navigating). The "arrows edit the
// field, not the grid" invariant is the heart of it: while editing, arrows move the caret and the
// navigation does not move. The last card is LIVE.

/** A readable trace of an edit script: "Enter → type 'Beatriz' → Enter". */
function editTrace(steps: EditStep[]): string {
  const fmt = (s: EditStep) => ('key' in s ? s.key : `type “${s.type}”`);
  return steps.map(fmt).join(' → ');
}

/** Dispatch a keydown on a specific element (bubbling) — the demo replays on explicit targets. */
function pressOn(target: HTMLElement, key: string): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

function editorOf(root: HTMLElement): (HTMLInputElement & HTMLSelectElement) | null {
  return root.querySelector('.grid-cell-input');
}

/** Render a grid + attach BOTH behaviors (navigation + edit), seeded at `active`. */
function wireEditableGrid(c: { rows: Row[]; config: DataGridConfig }, active: CellPosition) {
  const root = renderDataGrid(c.rows, c.config, active);
  root.setAttribute('grid:cell-navigation', '');
  root.setAttribute('grid:cell-edit', '');

  const nav = new DataGridBehavior({ name: 'grid:cell-navigation' });
  nav.attach(root);
  nav.isConnected = true;
  nav.connectedCallback();

  const edit = new DataGridEditBehavior({ name: 'grid:cell-edit' });
  edit.attach(root);
  edit.isConnected = true;
  edit.connectedCallback();

  return { root, nav, edit };
}

function buildEditableReplayCard(c: EditableCase): HTMLElement {
  const section = el('section', 'ex');
  const title = el('h2', 'ex-title');
  title.append(document.createTextNode(c.title + ' '));
  const badge = el('span', 'badge info', '…');
  title.append(badge);
  section.append(title);

  section.append(el('p', 'ex-contract', `Focus (${c.start.row}, ${c.start.col}) → ${editTrace(c.steps)}`));
  if (c.note) section.append(el('p', 'ex-note', c.note));

  const { root, edit } = wireEditableGrid(c, c.start);
  // Declare any read-only cells (#159) before replaying — Enter/F2 on these must not open an editor.
  for (const pos of c.readonly ?? []) {
    root.querySelector(`[data-row="${pos.row}"][data-col="${pos.col}"]`)?.setAttribute('aria-readonly', 'true');
  }
  // Declare any typed editors (#158) before replaying — kind + options + required.
  for (const e of c.editors ?? []) {
    const cell = root.querySelector(`[data-row="${e.at.row}"][data-col="${e.at.col}"]`);
    cell?.setAttribute('data-editor', e.kind);
    if (e.options) cell?.setAttribute('data-editor-options', e.options);
    if (e.required) cell?.setAttribute('data-editor-required', '');
  }

  // Replay the script on explicit targets (the cards aren't in the document yet, so focus is a no-op):
  // before editing the target is the start cell, once editing it's the editor input.
  const startCell = root.querySelector<HTMLElement>(`[data-row="${c.start.row}"][data-col="${c.start.col}"]`)!;
  for (const step of c.steps) {
    if ('key' in step) pressOn(editorOf(root) ?? startCell, step.key);
    else editorOf(root)!.value = step.type;
  }

  const result = auditEditableGrid(root, { editingAt: edit.editingAt });
  if (result.ok) passCount++;
  badge.className = `badge ${result.ok ? 'pass' : 'fail'}`;
  badge.textContent = result.ok ? '✓ conformant' : '✗ contract violation';

  const grid = el('div', 'ex-grid');
  section.append(grid);
  const live = el('div', 'preview');
  live.append(root);
  grid.append(pane(edit.editing ? 'Grid (editor open)' : 'Grid (after commit/cancel)', live));
  grid.append(pane('Produced HTML', el('pre', 'code', root.outerHTML)));
  grid.append(pane('Editable mode audit', checklist(result)));

  return section;
}

function buildLiveEditableCard(): HTMLElement {
  const section = el('section', 'ex interactive');
  const title = el('h2', 'ex-title');
  title.append(document.createTextNode(`${editableCases.length + 1} · Live — driven by the real grid:cell-edit behavior `));
  const badge = el('span', 'badge info', '…');
  title.append(badge);
  section.append(title);

  section.append(
    el(
      'p',
      'ex-note',
      'Click a data cell (or Tab into the grid and arrow to one), then Enter or F2 to edit it. Each column declares its editor: Name is a text field, Team is a select, Salary is a required number (clearing it and pressing Enter is rejected — the editor stays open, marked invalid), and Location is read-only (Enter/F2 do nothing). While editing, arrow keys move the caret/selection WITHIN the field — the grid does not navigate. Enter commits, Escape restores, clicking away commits (or cancels if invalid). The commit fires a grid-cell-edit-commit event (the seam an app uses for optimistic / server writes); this card just listens and re-runs the shared audit.',
    ),
  );

  const readout = el('p', 'live-region');
  readout.setAttribute('role', 'status');
  readout.setAttribute('aria-live', 'polite');
  section.append(readout);

  const grid = el('div', 'ex-grid');
  section.append(grid);
  const live = el('div', 'preview');
  const checksPane = el('div');
  grid.append(pane('Live editable grid', live));
  grid.append(pane('Editable mode audit', checksPane));

  const { root, edit } = wireEditableGrid({ rows: PEOPLE, config: INTERACTIVE_CONFIG }, ORIGIN);
  // Showcase the typed editors (#158) and read-only declaration (#159) on one grid:
  //   Name → text (default) · Team → select · Salary → required number (validation) · Location → read-only.
  root.querySelectorAll('[role="gridcell"][data-col="1"]').forEach((c) => {
    c.setAttribute('data-editor', 'select');
    c.setAttribute('data-editor-options', 'Engineering,Design,Sales,Marketing');
  });
  root.querySelectorAll('[role="gridcell"][data-col="2"]').forEach((c) => {
    c.setAttribute('data-editor', 'number');
    c.setAttribute('data-editor-required', '');
  });
  root.querySelectorAll('[role="gridcell"][data-col="3"]').forEach((c) => c.setAttribute('aria-readonly', 'true'));
  live.append(root);

  function audit(countInitial = false): void {
    const result = auditEditableGrid(root, { editingAt: edit.editingAt });
    if (countInitial && result.ok) passCount++;
    badge.className = `badge ${result.ok ? 'pass' : 'fail'}`;
    badge.textContent = result.ok
      ? edit.editing ? '✓ editing (navigation suspended)' : '✓ navigating (no editor)'
      : '✗ contract violation';
    checksPane.replaceChildren(checklist(result));
  }

  root.addEventListener('grid-cell-edit-start', (e) => {
    const { position } = (e as CustomEvent<GridCellEditDetail>).detail;
    readout.textContent = `Editing row ${position.row}, ${INTERACTIVE_CONFIG.columns[position.col].label} — arrows move the caret, Enter commits, Escape cancels.`;
    audit();
  });
  root.addEventListener('grid-cell-edit-commit', (e) => {
    const { position, value, previousValue } = (e as CustomEvent<GridCellEditCommitDetail>).detail;
    readout.textContent = `Committed row ${position.row}, ${INTERACTIVE_CONFIG.columns[position.col].label}: “${previousValue}” → “${value}”.`;
    audit();
  });
  root.addEventListener('grid-cell-edit-cancel', (e) => {
    const { position } = (e as CustomEvent<GridCellEditDetail>).detail;
    readout.textContent = `Cancelled row ${position.row}, ${INTERACTIVE_CONFIG.columns[position.col].label} — value restored.`;
    audit();
  });
  root.addEventListener('grid-cell-edit-invalid', (e) => {
    const { position, message } = (e as CustomEvent<{ position: CellPosition; message: string }>).detail;
    readout.textContent = `Invalid value in row ${position.row}, ${INTERACTIVE_CONFIG.columns[position.col].label}${message ? ` — ${message}` : ''}. Editor stays open.`;
    audit();
  });

  readout.textContent = 'Click a data cell, then Enter or F2 to edit.';
  audit(true); // the initial navigating state is conformant and counts toward the tally
  return section;
}

const host = document.getElementById('examples');
if (host) {
  const summary = el('div', 'summary', '');
  const cards = dataGridCases.map(buildCard);
  const interactive = buildInteractiveCard(); // bumps passCount on its initial green audit

  // The editable sub-pattern section, under its own heading.
  const editHead = el('div', 'section-head');
  editHead.append(el('h2', undefined, 'Editable cells — the grid:cell-edit sub-pattern'));
  editHead.append(
    el(
      'p',
      undefined,
      'The APG editable mode layered on the same navigation grid: Enter / F2 open an in-cell editor, arrows edit the field (navigation suspended), Enter commits, Escape cancels. Headers never edit.',
    ),
  );
  const editCards = editableCases.map(buildEditableReplayCard);
  const liveEdit = buildLiveEditableCard();

  const total = dataGridCases.length + 1 + editableCases.length + 1; // nav cards + live, edit cards + live
  host.replaceChildren(summary, ...cards, interactive, editHead, ...editCards, liveEdit);
  summary.className = `summary ${passCount === total ? 'pass' : 'fail'}`;
  summary.textContent = `${passCount}/${total} cases satisfy the verified data-grid contract (navigation + editing)`;
}

setPlaygroundReady(passCount);
