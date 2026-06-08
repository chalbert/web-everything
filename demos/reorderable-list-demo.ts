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
import {
  reduceCrossListReorder,
  relocate,
  renderCrossListReorder,
  reconcileCrossList,
  auditCrossListReorder,
  announceCrossList,
  initialCrossListState,
  type CrossListConfig,
  type CrossListEvent,
  type CrossListState,
  type ReorderList,
} from '/blocks/renderers/reorderable-list/renderCrossListReorder';
import { crossListReorderCases, type CrossListReorderCase } from '/blocks/renderers/reorderable-list/__fixtures__/cross-list-reorder-cases';

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

// ── Cross-list section (Tier-2 withCrossListReorder · reorder.scope.cross-list) ───────────────────
//
// The same block, one trait further: items move between SIBLING lists that share a reorder-group key.
// The order model is per-list; the roving tabindex spans the whole group; Left/Right move focus (and a
// grabbed item) ACROSS lists while ArrowUp/Down still move within the active list. Static fixture cards
// fold the keys through the SAME reduceCrossListReorder the live card uses; the last card is operable.

const CROSS_CONFIG: CrossListConfig = { group: 'board' };

/** "Start → Space → ArrowRight → todo[…] | doing[…] | done[…]" — the per-list landing orders. */
function crossKeyTrace(c: CrossListReorderCase): string {
  const seq = c.keys.length ? c.keys.map((k) => (k === ' ' ? 'Space' : k)).join(' → ') : '(no keys)';
  const orders = c.expected.lists.map((l) => `${l.label.toLowerCase()}[${l.order.join(', ')}]`).join(' | ');
  return `Start → ${seq} → ${orders}`;
}

/** Fold a key sequence through the cross-list reducer from the initial state, tracking the last event. */
function walkCross(lists: ReorderList[], keys: string[]): { state: CrossListState; lastEvent: CrossListEvent | null } {
  let state = initialCrossListState(lists);
  let lastEvent: CrossListEvent | null = null;
  for (const key of keys) {
    const r = reduceCrossListReorder(state, key);
    state = r.state;
    if (r.event) lastEvent = r.event;
  }
  return { state, lastEvent };
}

function buildCrossCard(c: CrossListReorderCase): HTMLElement {
  const section = el('section', 'ex');
  const title = el('h2', 'ex-title');
  title.append(document.createTextNode(c.title + ' '));
  const badge = el('span', 'badge info', '…');
  title.append(badge);
  section.append(title);

  section.append(el('p', 'ex-contract', crossKeyTrace(c)));
  if (c.note) section.append(el('p', 'ex-note', c.note));

  const { state, lastEvent } = walkCross(c.lists, c.keys);
  const root = renderCrossListReorder(c.lists, c.items, CROSS_CONFIG, state);
  const result = auditCrossListReorder(root, c.items, state, CROSS_CONFIG);
  if (result.ok) passCount++;

  badge.className = `badge ${result.ok ? 'pass' : 'fail'}`;
  badge.textContent = result.ok ? '✓ conformant' : '✗ contract violation';

  const grid = el('div', 'ex-grid');
  section.append(grid);

  const live = el('div', 'preview');
  live.append(root);
  grid.append(pane('Group (sibling lists; grabbed item lifted)', live));
  const ann = el('div', 'live-region');
  ann.setAttribute('role', 'status');
  ann.textContent = lastEvent ? announceCrossList(lastEvent, state, c.items) : '';
  grid.append(pane('Announced', ann));
  grid.append(pane('Produced HTML', el('pre', 'code', root.outerHTML)));
  grid.append(pane('Contract audit', checklist(result)));

  return section;
}

const BOARD_ITEMS: ReorderItem[] = [
  { id: 'spec', label: 'Write the spec' },
  { id: 'build', label: 'Build the block' },
  { id: 'test', label: 'Add the conformance test' },
  { id: 'ship', label: 'Ship it' },
];
const boardLists = (): ReorderList[] => [
  { id: 'todo', label: 'Todo', order: ['spec', 'build'] },
  { id: 'doing', label: 'Doing', order: ['test'] },
  { id: 'done', label: 'Done', order: ['ship'] },
];

function buildCrossInteractiveCard(): HTMLElement {
  const section = el('section', 'ex interactive');
  const title = el('h2', 'ex-title');
  title.append(document.createTextNode(`${crossListReorderCases.length + 1} · Live — move cards between sibling lists `));
  const badge = el('span', 'badge info', '…');
  title.append(badge);
  section.append(title);

  section.append(
    el(
      'p',
      'ex-note',
      'Operable: click a card or Tab in, then Space grabs it. ArrowUp/Down move it within its list; ArrowLeft/Right move it to a sibling list; Space/Enter drops (commits), Escape cancels (reverts across lists). Or drag a card with the pointer into another list. Cards relocate with the atomic Element.moveBefore() — even across lists — each move is announced, and the committed per-list order is written below. The model CI also drives the fixtures above.',
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
  grid.append(pane('Live board', live));
  grid.append(pane('Contract audit', checksPane));

  const committed = el('p', 'committed');
  section.append(committed);

  let state = initialCrossListState(boardLists());
  const root = renderCrossListReorder(boardLists(), BOARD_ITEMS, CROSS_CONFIG, state);
  live.append(root);

  function runAudit(countInitial = false): void {
    const result = auditCrossListReorder(root, BOARD_ITEMS, state, CROSS_CONFIG);
    if (countInitial && result.ok) passCount++;
    badge.className = `badge ${result.ok ? 'pass' : 'fail'}`;
    badge.textContent = result.ok ? '✓ conformant' : '✗ contract violation';
    checksPane.replaceChildren(checklist(result));
  }

  function apply(next: CrossListState, event: CrossListEvent | null, focus: boolean): void {
    state = next;
    const focusable = reconcileCrossList(root, state);
    if (focus && focusable) focusable.focus();
    if (event) {
      liveRegion.textContent = announceCrossList(event, state, BOARD_ITEMS);
      root.dispatchEvent(new CustomEvent(event.type, { detail: event, bubbles: true, cancelable: event.type === 'reorder-commit' }));
    }
    runAudit();
  }

  root.addEventListener('reorder-commit', ((e: CustomEvent<CrossListEvent>) => {
    const orders = e.detail.orders ?? Object.fromEntries(state.lists.map((l) => [l.id, l.order]));
    committed.textContent = `committed → ${state.lists.map((l) => `${l.label.toLowerCase()}[${(orders[l.id] ?? []).join(', ')}]`).join(' | ')}`;
  }) as EventListener);

  // ── Keyboard path (the headline). ──
  root.addEventListener('keydown', (e) => {
    if (!REORDER_KEYS.has(e.key)) return;
    e.preventDefault();
    const r = reduceCrossListReorder(state, e.key);
    apply(r.state, r.event, true);
  });

  // Click-to-focus — clicking a card makes it the focused (roving) item when nothing is grabbed.
  root.addEventListener('click', (e) => {
    if (state.grabbedIndex !== -1) return;
    const li = (e.target as HTMLElement).closest<HTMLElement>('[data-reorder-id]');
    const ul = (e.target as HTMLElement).closest<HTMLElement>('[data-list-id]');
    if (!li || !ul) return;
    const listIndex = state.lists.findIndex((l) => l.id === ul.getAttribute('data-list-id'));
    const idx = state.lists[listIndex]?.order.indexOf(li.getAttribute('data-reorder-id')!);
    if (listIndex >= 0 && idx != null && idx >= 0 && (listIndex !== state.activeList || idx !== state.focusIndex)) {
      apply({ ...state, activeList: listIndex, focusIndex: idx }, null, true);
    }
  });

  // ── Pointer-drag path — grab a card, then hit-test which list + slot the pointer is over. ──
  root.addEventListener('pointerdown', (e) => {
    const li = (e.target as HTMLElement).closest<HTMLElement>('[data-reorder-id]');
    const ul = (e.target as HTMLElement).closest<HTMLElement>('[data-list-id]');
    if (!li || !ul || state.grabbedIndex !== -1) return;
    const listIndex = state.lists.findIndex((l) => l.id === ul.getAttribute('data-list-id'));
    const idx = state.lists[listIndex]?.order.indexOf(li.getAttribute('data-reorder-id')!);
    if (listIndex < 0 || idx == null || idx < 0) return;
    li.setPointerCapture?.(e.pointerId);
    apply(
      { ...state, activeList: listIndex, focusIndex: idx, grabbedIndex: idx, grabbedFromList: listIndex, grabbedFromIndex: idx },
      { type: 'reorder-start', itemId: state.lists[listIndex].order[idx], fromList: listIndex, fromIndex: idx },
      false,
    );
  });

  root.addEventListener('pointermove', (e) => {
    if (state.grabbedIndex === -1) return;
    const uls = Array.from(root.querySelectorAll<HTMLElement>('[data-list-id]'));
    // Which list is the pointer over (by horizontal band; fall back to the nearest)?
    let targetList = uls.findIndex((u) => {
      const r = u.getBoundingClientRect();
      return e.clientX >= r.left && e.clientX <= r.right;
    });
    if (targetList < 0) return;
    // Which slot within that list (by the Y midpoint of its cards)?
    const cards = Array.from(uls[targetList].querySelectorAll<HTMLElement>('[data-reorder-id]'));
    let targetIndex = cards.length;
    for (let i = 0; i < cards.length; i++) {
      const r = cards[i].getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) { targetIndex = i; break; }
    }
    if (targetList === state.activeList && targetIndex > state.grabbedIndex) targetIndex--; // account for the gap the grabbed card leaves
    if (targetList !== state.activeList || targetIndex !== state.grabbedIndex) {
      const r = relocate(state, targetList, targetIndex);
      if (r.event) apply(r.state, r.event, false);
    }
  });

  const drop = () => {
    if (state.grabbedIndex === -1) return;
    const cur = state.grabbedIndex;
    apply(
      { ...state, grabbedIndex: -1, grabbedFromList: -1, grabbedFromIndex: -1, focusIndex: cur },
      {
        type: 'reorder-commit',
        itemId: state.lists[state.activeList].order[cur],
        fromList: state.grabbedFromList,
        fromIndex: state.grabbedFromIndex,
        toList: state.activeList,
        toIndex: cur,
        crossed: state.grabbedFromList !== state.activeList,
        orders: Object.fromEntries(state.lists.map((l) => [l.id, l.order.slice()])),
      },
      true,
    );
  };
  root.addEventListener('pointerup', drop);
  root.addEventListener('pointercancel', drop);

  runAudit(true);
  return section;
}

const host = document.getElementById('examples');
if (host) {
  const summary = el('div', 'summary', '');
  const cards = reorderableListCases.map(buildCard);
  const interactive = buildInteractiveCard(); // bumps passCount on its initial green audit

  // Tier-2 cross-list section — a heading, the fixture cards, then the live board.
  const crossHeading = el('h2', 'section-heading', 'Cross-list scope — move items between sibling lists (withCrossListReorder)');
  const crossIntro = el(
    'p',
    'section-intro',
    'The Tier-2 scope: a reorder-group binds sibling lists so an item can move between them. The order model is per-list, the roving tabindex spans the whole group, and Left/Right move across lists while ArrowUp/Down move within one — the same reduceReorder is the inner loop for the within-list part.',
  );
  const crossCards = crossListReorderCases.map(buildCrossCard);
  const crossInteractive = buildCrossInteractiveCard();

  const total = reorderableListCases.length + 1 + crossListReorderCases.length + 1; // within-list + cross-list, each + its live card
  host.replaceChildren(summary, ...cards, interactive, crossHeading, crossIntro, ...crossCards, crossInteractive);
  summary.className = `summary ${passCount === total ? 'pass' : 'fail'}`;
  summary.textContent = `${passCount}/${total} cases satisfy the verified reorder contract (within-list + cross-list)`;
}

setPlaygroundReady(passCount);
