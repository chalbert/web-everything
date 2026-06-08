/**
 * Background Task Surface Playground — drive a real `<background-tasks>` surface
 * through scripted Loader handles and prove a contract invariant per card.
 *
 * The surface is the receiving end of a Loader's `escalation:async` handoff: a
 * descendant dispatches a bubbling `background-task-register` event carrying a
 * live Loader state handle, and the surface subscribes to it off-view. This
 * playground supplies a scripted handle (the test twin) so each invariant can be
 * exercised deterministically in a browser, then renders a pass/fail badge.
 *
 * Scenarios + the mock handle come from the SHARED fixture module the unit suite
 * imports, so the badges below and CI exercise the same behavior. Native APIs
 * only — no bootstrap, no JSX.
 */

import { setPlaygroundReady } from '/demos/playground-harness';
import {
  registerBackgroundTasks,
  type BackgroundTasksElement,
} from '/blocks/background-task-surface/index';
import {
  MockLoaderHandle,
  registerTask,
  taskScenarios,
  type TaskScenario,
} from '/blocks/background-task-surface/__fixtures__/mock-loader';

registerBackgroundTasks();

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

function el(tag: string, className?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/** Build a configured surface, register a scripted task from a descendant. */
function makeSurface(attrs: Record<string, string>): BackgroundTasksElement {
  const surface = document.createElement('background-tasks') as BackgroundTasksElement;
  for (const [k, v] of Object.entries(attrs)) surface.setAttribute(k, v);
  surface.autoClearDelayMs = 0; // deterministic auto-clear for the demo
  return surface;
}

const rows = (s: Element) => s.querySelectorAll('.bt-entry');
const stateOf = (s: Element, id: string) =>
  s.querySelector(`.bt-entry[data-task-id="${id}"]`)?.getAttribute('data-state') ?? null;
const liveText = (s: Element) => s.querySelector('.bt-status')?.textContent ?? '';

type Result = { ok: boolean; detail: string };

/** One runner per scenario id — asserts that scenario's invariant on a live surface. */
const runners: Record<string, (s: BackgroundTasksElement) => Promise<Result>> = {
  async 'transient-success'(s) {
    const h = new MockLoaderHandle({ state: 'active' });
    const src = el('div');
    s.appendChild(src);
    registerTask(s, { id: 't', label: 'Export', handle: h, source: src });
    h.emit({ state: 'success' });
    const announced = liveText(s) === 'Export complete';
    await tick();
    const cleared = rows(s).length === 0;
    return { ok: announced && cleared, detail: `announced=${announced}, cleared=${cleared}` };
  },
  async 'sticky-success'(s) {
    const h = new MockLoaderHandle({ state: 'active' });
    registerTask(s, { id: 't', label: 'Export', handle: h });
    h.emit({ state: 'success' });
    await tick();
    const kept = stateOf(s, 't') === 'success';
    return { ok: kept, detail: `entry persists in state=${stateOf(s, 't')}` };
  },
  async 'error-sticky'(s) {
    const h = new MockLoaderHandle({ state: 'active' });
    registerTask(s, { id: 't', label: 'Sync', handle: h });
    h.emit({ state: 'error', error: new Error('network') });
    await tick();
    const kept = stateOf(s, 't') === 'error';
    const announced = liveText(s) === 'Sync failed';
    return { ok: kept && announced, detail: `state=${stateOf(s, 't')}, announced=${announced}` };
  },
  async 'batch-concurrent'(s) {
    const a = new MockLoaderHandle({ state: 'active' });
    const b = new MockLoaderHandle({ state: 'active' });
    registerTask(s, { id: 'a', label: 'Upload A', handle: a });
    registerTask(s, { id: 'b', label: 'Upload B', handle: b });
    const both = rows(s).length === 2;
    a.emit({ state: 'error', error: new Error('x') });
    const isolated = stateOf(s, 'a') === 'error' && stateOf(s, 'b') === 'active';
    return { ok: both && isolated, detail: `rendered=${rows(s).length}, isolated=${isolated}` };
  },
  async 'retry-delegates'(s) {
    const h = new MockLoaderHandle({ state: 'active' });
    let fired = false;
    s.addEventListener('background-task-retry', () => { fired = true; });
    registerTask(s, { id: 't', label: 'Save', handle: h });
    h.emit({ state: 'error', error: new Error('fail') });
    const btn = s.querySelector('.bt-entry[data-task-id="t"] .bt-retry') as HTMLButtonElement | null;
    btn?.click();
    const ok = !!btn && fired && h.retried === 1 && stateOf(s, 't') === 'active';
    return { ok, detail: `button=${!!btn}, fired=${fired}, delegated=${h.retried === 1}` };
  },
};

let passCount = 0;

/** Build a card's DOM (badge unresolved); return it plus a deferred run(). */
function buildCard(scenario: TaskScenario): {
  node: HTMLElement;
  run: () => Promise<void>;
} {
  const section = el('section', 'ex');
  const title = el('h2', 'ex-title');
  title.append(document.createTextNode(scenario.title + ' '));
  const badge = el('span', 'badge info', '…');
  title.append(badge);
  section.append(title);
  section.append(el('p', 'ex-note', scenario.note));

  const grid = el('div', 'ex-grid');

  // Invariant pane
  const invPane = el('div', 'pane');
  invPane.append(el('div', 'pane-label', 'Invariant'));
  invPane.append(el('pre', 'code', scenario.invariant));
  const attrsText = Object.keys(scenario.attrs).length
    ? Object.entries(scenario.attrs).map(([k, v]) => (v ? `${k}="${v}"` : k)).join(' ')
    : '(defaults)';
  invPane.append(el('div', 'pane-label', 'Surface config'));
  invPane.append(el('pre', 'code', `<background-tasks ${attrsText}>`));
  grid.append(invPane);

  // Live surface pane
  const livePane = el('div', 'pane');
  livePane.append(el('div', 'pane-label', 'Live surface'));
  const preview = el('div', 'preview');
  const surface = makeSurface(scenario.attrs);
  preview.append(surface);
  livePane.append(preview);
  grid.append(livePane);

  section.append(grid);

  // run() executes after the card is in the document, so connectedCallback fired.
  const run = async () => {
    const result = await runners[scenario.id](surface);
    badge.className = `badge ${result.ok ? 'pass' : 'fail'}`;
    badge.textContent = result.ok ? `✓ ${result.detail}` : `✗ ${result.detail}`;
    if (result.ok) passCount++;
  };

  return { node: section, run };
}

async function main(): Promise<void> {
  const host = document.getElementById('examples');
  if (!host) return;

  const summary = el('div', 'summary', '');
  const cards = taskScenarios.map(buildCard);
  // Mount first so every surface connects (scaffold + register listener) before run.
  host.replaceChildren(summary, ...cards.map((c) => c.node));

  for (const card of cards) await card.run();

  summary.className = `summary ${passCount === taskScenarios.length ? 'pass' : 'fail'}`;
  summary.textContent = `${passCount}/${taskScenarios.length} invariants hold (surface contract conformant)`;

  setPlaygroundReady(passCount);
}

void main();
