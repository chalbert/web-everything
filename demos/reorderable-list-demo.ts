/**
 * Reorderable List Playground — exercise the Reorderable List block's verified reorder contract live.
 *
 * For each shared fixture it (1) shows the key sequence, (2) folds it through the SAME reducer the live
 * card uses and renders the list AT the state it lands on, (3) shows the produced HTML, and (4) runs
 * the SAME audit the CI conformance suite asserts — a green badge means the list satisfies the verified
 * reorder structure + roving-tabindex contract. The last card is LIVE: grab an item with the keyboard
 * (Space, then arrows, then Space/Enter to drop or Escape to cancel) or drag it with the pointer; items
 * relocate with the atomic Element.moveBefore(), each move is announced through a polite live region,
 * and the cancelable reorder-commit event drives the "committed order" read-out. Reducer, renderer,
 * announcer, audit, and fixtures are the one shared source, so the badges below and CI exercise the
 * exact same code. See /blocks/reorderable-list/. Native DOM only.
 */
import { setPlaygroundReady } from '/demos/playground-harness';
import {
  reduceReorder,
  renderReorderableList,
  auditReorderableList,
  reconcileOrder,
  announce,
  initialState,
  move,
  REORDER_KEYS,
  type AuditResult,
  type ReorderEvent,
  type ReorderItem,
  type ReorderState,
} from '/blocks/renderers/reorderable-list/renderReorderableList';
import { reorderableListCases, type ReorderableListCase } from '/blocks/renderers/reorderable-list/__fixtures__/reorderable-list-cases';

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

/** Render a key sequence as a readable trace: "Start → Space → ArrowDown → order [build, spec, …]". */
function keyTrace(c: ReorderableListCase): string {
  const seq = c.keys.length ? c.keys.map((k) => (k === ' ' ? 'Space' : k)).join(' → ') : '(no keys)';
  return `Start → ${seq} → order [${c.expected.order.join(', ')}]`;
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

/** Fold a key sequence through the shared reducer from the initial state, tracking the last event. */
function walk(items: ReorderItem[], keys: string[]): { state: ReorderState; lastEvent: ReorderEvent | null } {
  let state = initialState(items);
  let lastEvent: ReorderEvent | null = null;
  for (const key of keys) {
    const r = reduceReorder(state, key);
    state = r.state;
    if (r.event) lastEvent = r.event;
  }
  return { state, lastEvent };
}

let passCount = 0;

function buildCard(c: ReorderableListCase): HTMLElement {
  const section = el('section', 'ex');
  const title = el('h2', 'ex-title');
  title.append(document.createTextNode(c.title + ' '));
  const badge = el('span', 'badge info', '…');
  title.append(badge);
  section.append(title);

  section.append(el('p', 'ex-contract', keyTrace(c)));
  if (c.note) section.append(el('p', 'ex-note', c.note));

  // Fold the keys through the shared reducer, render the list at the landing state, audit.
  const { state, lastEvent } = walk(c.items, c.keys);
  const root = renderReorderableList(c.items, {}, state);
  const result = auditReorderableList(root, c.items, state);
  if (result.ok) passCount++;

  badge.className = `badge ${result.ok ? 'pass' : 'fail'}`;
  badge.textContent = result.ok ? '✓ conformant' : '✗ contract violation';

  const grid = el('div', 'ex-grid');
  section.append(grid);

  const live = el('div', 'preview');
  live.append(root);
  grid.append(pane('List (focused item highlighted, grabbed item lifted)', live));
  // The announcement this sequence would speak (the live-region wording, double-checked by CI).
  const ann = el('div', 'live-region');
  ann.setAttribute('role', 'status');
  ann.textContent = lastEvent ? announce(lastEvent, c.items) : '';
  grid.append(pane('Announced', ann));
  grid.append(pane('Produced HTML', el('pre', 'code', root.outerHTML)));
  grid.append(pane('Contract audit', checklist(result)));

  return section;
}

// ── Interactive (live) card — real keyboard reorder + pointer drag with moveBefore relocation ─────
//
// Unlike the static fixture cards, this list is OPERABLE: focus an item and Space grabs it, the arrows
// move it, Space/Enter drops (committing), Escape cancels (reverting) — OR drag it with the pointer.
// Every keyboard step runs through the SAME reduceReorder engine; the DOM is reconciled with
// Element.moveBefore() (so a moved card keeps its state), each move is announced, and the cancelable
// reorder-commit event drives the committed-order read-out. The audit re-runs on every change so the
// badge stays honest — the model CI also drives through the fixtures.

const TASKS: ReorderItem[] = [
  { id: 'spec', label: 'Write the spec' },
  { id: 'build', label: 'Build the block' },
  { id: 'test', label: 'Add the conformance test' },
  { id: 'demo', label: 'Wire the playground' },
  { id: 'ship', label: 'Ship it' },
];

function buildInteractiveCard(): HTMLElement {
  const section = el('section', 'ex interactive');
  const title = el('h2', 'ex-title');
  title.append(document.createTextNode(`${reorderableListCases.length + 1} · Live — keyboard grab-and-move, or drag with the pointer `));
  const badge = el('span', 'badge info', '…');
  title.append(badge);
  section.append(title);

  section.append(
    el(
      'p',
      'ex-note',
      'Operable: click an item or Tab in, then Space grabs it, ArrowUp/Down move it, Space/Enter drops (commits), Escape cancels (reverts). Or drag an item with the pointer. Items relocate with the atomic Element.moveBefore(); each move is announced through the live region and the committed order is written below — the model CI also drives.',
    ),
  );

  const liveRegion = el('p', 'live-region');
  liveRegion.setAttribute('role', 'status');
  liveRegion.setAttribute('aria-live', 'polite');
  section.append(liveRegion);

  const grid = el('div', 'ex-grid');
  section.append(grid);
  const live = el('div', 'preview');
  const checksPane = el('div');
  grid.append(pane('Live list', live));
  grid.append(pane('Contract audit', checksPane));

  const committed = el('p', 'committed');
  section.append(committed);

  let state = initialState(TASKS);
  const root = renderReorderableList(TASKS, { listLabel: 'Backlog order' }, state);
  live.append(root);

  function runAudit(countInitial = false): void {
    const result = auditReorderableList(root, TASKS, state);
    if (countInitial && result.ok) passCount++;
    badge.className = `badge ${result.ok ? 'pass' : 'fail'}`;
    badge.textContent = result.ok ? '✓ conformant' : '✗ contract violation';
    checksPane.replaceChildren(checklist(result));
  }

  /** Apply a new state: reconcile the DOM (moveBefore), optionally focus, announce + dispatch the event. */
  function apply(next: ReorderState, event: ReorderEvent | null, focus: boolean): void {
    state = next;
    const focusable = reconcileOrder(root, state);
    if (focus && focusable) focusable.focus();
    if (event) {
      liveRegion.textContent = announce(event, TASKS);
      const ce = new CustomEvent(event.type, {
        detail: event,
        bubbles: true,
        cancelable: event.type === 'reorder-commit',
      });
      root.dispatchEvent(ce);
    }
    runAudit();
  }

  // The cancelable reorder-commit is the persistence seam — here a host listener just records the new
  // order (the ephemeral default). A real host could preventDefault() to reject and revert.
  root.addEventListener('reorder-commit', ((e: CustomEvent<ReorderEvent>) => {
    committed.textContent = `committed order → [${(e.detail.order ?? state.order).join(', ')}]`;
  }) as EventListener);

  // ── Keyboard path (the headline) — the delegated keydown handler reads the shared engine. ──
  root.addEventListener('keydown', (e) => {
    if (!REORDER_KEYS.has(e.key)) return;
    e.preventDefault(); // Space/arrows would scroll; Home/End would jump the page
    const r = reduceReorder(state, e.key);
    apply(r.state, r.event, true);
  });

  // Click-to-focus — clicking an item makes it the focused (roving) item when nothing is grabbed.
  root.addEventListener('click', (e) => {
    if (state.grabbedIndex !== -1) return;
    const li = (e.target as HTMLElement).closest('[data-reorder-id]');
    if (!li) return;
    const idx = state.order.indexOf(li.getAttribute('data-reorder-id')!);
    if (idx >= 0 && idx !== state.focusIndex) apply({ ...state, focusIndex: idx }, null, true);
  });

  // ── Pointer-drag path — Pointer Events + setPointerCapture; index from the pointer's Y midpoint. ──
  root.addEventListener('pointerdown', (e) => {
    const li = (e.target as HTMLElement).closest<HTMLElement>('[data-reorder-id]');
    if (!li || state.grabbedIndex !== -1) return;
    const idx = state.order.indexOf(li.getAttribute('data-reorder-id')!);
    if (idx < 0) return;
    li.setPointerCapture?.(e.pointerId);
    const next = { ...state, focusIndex: idx, grabbedIndex: idx, grabbedFrom: idx };
    apply(next, { type: 'reorder-start', itemId: state.order[idx], fromIndex: idx }, false);
  });

  root.addEventListener('pointermove', (e) => {
    if (state.grabbedIndex === -1) return;
    const lis = Array.from(root.children) as HTMLElement[];
    let target = lis.length - 1;
    for (let i = 0; i < lis.length; i++) {
      const r = lis[i].getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) { target = i; break; }
    }
    if (target !== state.grabbedIndex) {
      const order = move(state.order, state.grabbedIndex, target);
      apply(
        { ...state, order, grabbedIndex: target, focusIndex: target },
        { type: 'reorder-move', itemId: state.order[state.grabbedIndex], fromIndex: state.grabbedFrom, toIndex: target },
        false,
      );
    }
  });

  const drop = () => {
    if (state.grabbedIndex === -1) return;
    const cur = state.grabbedIndex;
    apply(
      { ...state, grabbedIndex: -1, grabbedFrom: -1, focusIndex: cur },
      { type: 'reorder-commit', itemId: state.order[cur], fromIndex: state.grabbedFrom, toIndex: cur, order: state.order.slice() },
      true,
    );
  };
  root.addEventListener('pointerup', drop);
  root.addEventListener('pointercancel', drop);

  runAudit(true); // initial paint counts toward the tally, like the static cards
  return section;
}

const host = document.getElementById('examples');
if (host) {
  const summary = el('div', 'summary', '');
  const cards = reorderableListCases.map(buildCard);
  const interactive = buildInteractiveCard(); // bumps passCount on its initial green audit
  const total = reorderableListCases.length + 1; // + the live interactive card
  host.replaceChildren(summary, ...cards, interactive);
  summary.className = `summary ${passCount === total ? 'pass' : 'fail'}`;
  summary.textContent = `${passCount}/${total} cases satisfy the verified reorder contract`;
}

setPlaygroundReady(passCount);
