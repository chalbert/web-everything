/**
 * Loader → Background Task Surface handoff playground (producer side).
 *
 * Where the Background Task Surface playground drives the surface through a
 * *scripted* handle, this one wires the **real** producer: a real
 * `ResourceLoader` running `backgroundLoad` escalates into a real
 * `<background-tasks>` rail when its work crosses the debounce threshold. Each
 * card auto-runs a deterministic scenario and a badge proves one invariant of
 * the escalation contract.
 *
 * Scenarios + the controllable-promise lever come from the SHARED fixture module
 * the unit suite imports, so the badges below and CI exercise the same behavior
 * (the demo-first anti-drift split). Native APIs only — no bootstrap, no JSX.
 */

import { setPlaygroundReady } from '/demos/playground-harness';
import {
  registerBackgroundTasks,
  type BackgroundTasksElement,
} from '/blocks/background-task-surface/index';
import { ResourceLoader, backgroundLoad } from '/blocks/resource-loader/index';
import {
  createDeferred,
  handoffScenarios,
  type HandoffScenario,
} from '/blocks/resource-loader/__fixtures__/handoff-scenarios';

registerBackgroundTasks();

/** Snappy debounce so the escalation threshold is visible without a long wait. */
const THRESHOLD_MS = 150;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const tick = () => sleep(0);

function el(tag: string, className?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

const rows = (s: Element) => s.querySelectorAll('.bt-entry');
const stateOf = (s: Element, id: string) =>
  s.querySelector(`.bt-entry[data-task-id="${id}"]`)?.getAttribute('data-state') ?? null;

/** Build a surface with a loader target inside it (so the register bubbles up). */
function makeSurface(attrs: Record<string, string> = {}): BackgroundTasksElement {
  const surface = document.createElement('background-tasks') as BackgroundTasksElement;
  for (const [k, v] of Object.entries(attrs)) surface.setAttribute(k, v);
  surface.autoClearDelayMs = 0;
  surface.appendChild(document.createElement('div')); // the loader's target
  return surface;
}

/** The loader for a card's surface — its target is the div mounted inside. */
const loaderFor = (surface: Element) =>
  new ResourceLoader({
    target: surface.querySelector('div') as HTMLElement,
    timings: { debounced: THRESHOLD_MS },
  });

type Result = { ok: boolean; detail: string };

/** One runner per scenario — drives the real pair and asserts the invariant. */
const runners: Record<string, (s: BackgroundTasksElement) => Promise<Result>> = {
  async 'escalate-on-async'(surface) {
    const loader = loaderFor(surface);
    const d = createDeferred<string>();
    const p = backgroundLoad(loader, () => d.promise, { id: 'export', label: 'Export data' });

    const beforeThreshold = rows(surface).length === 0;
    await sleep(THRESHOLD_MS + 40);
    const escalated = stateOf(surface, 'export') === 'active';

    d.resolve('1,024 rows');
    await p;
    await tick();
    const succeeded = stateOf(surface, 'export') === 'success';

    return {
      ok: beforeThreshold && escalated && succeeded,
      detail: `pre-empty=${beforeThreshold}, escalated=${escalated}, success=${succeeded}`,
    };
  },

  async 'fast-load-no-escalate'(surface) {
    const loader = loaderFor(surface);
    const d = createDeferred<string>();
    const p = backgroundLoad(loader, () => d.promise, { id: 'fast', label: 'Quick fetch' });

    d.resolve('done'); // resolves before the threshold
    const result = await p;
    await sleep(THRESHOLD_MS + 40); // prove nothing escalates late
    const empty = rows(surface).length === 0;

    return { ok: result.state === 'success' && empty, detail: `result=${result.state}, rail-empty=${empty}` };
  },

  async 'error-then-retry'(surface) {
    const loader = loaderFor(surface);
    const deferreds: Array<ReturnType<typeof createDeferred<string>>> = [];
    let attempts = 0;
    const fn = () => {
      attempts++;
      const d = createDeferred<string>();
      deferreds.push(d);
      return d.promise;
    };

    const p = backgroundLoad(loader, fn, { id: 'sync', label: 'Sync changes' });
    await sleep(THRESHOLD_MS + 40);
    deferreds[0].reject(new Error('network'));
    await p;
    await tick();
    const failedSticky = stateOf(surface, 'sync') === 'error' && attempts === 1;

    const btn = surface.querySelector(
      '.bt-entry[data-task-id="sync"] .bt-retry',
    ) as HTMLButtonElement | null;
    btn?.click();
    const reran = attempts === 2;
    await sleep(THRESHOLD_MS + 40);
    const activeAgain = stateOf(surface, 'sync') === 'active';

    return {
      ok: !!btn && failedSticky && reran && activeAgain,
      detail: `error-sticky=${failedSticky}, retry-reran=${reran}, active-again=${activeAgain}`,
    };
  },
};

let passCount = 0;

/** Build a card's DOM (badge unresolved); return it plus a deferred run(). */
function buildCard(scenario: HandoffScenario): { node: HTMLElement; run: () => Promise<void> } {
  const section = el('section', 'ex');
  const title = el('h2', 'ex-title');
  title.append(document.createTextNode(scenario.title + ' '));
  const badge = el('span', 'badge info', '…');
  title.append(badge);
  section.append(title);
  section.append(el('p', 'ex-note', scenario.note));

  const grid = el('div', 'ex-grid');

  const invPane = el('div', 'pane');
  invPane.append(el('div', 'pane-label', 'Invariant'));
  invPane.append(el('pre', 'code', scenario.invariant));
  invPane.append(el('div', 'pane-label', 'Producer'));
  invPane.append(el('pre', 'code', "backgroundLoad(loader, fn, { id, label })"));
  grid.append(invPane);

  const livePane = el('div', 'pane');
  livePane.append(el('div', 'pane-label', 'Live rail'));
  const preview = el('div', 'preview');
  const surface = makeSurface(
    scenario.id === 'error-then-retry'
      ? { retry: '', persistence: 'sticky' }
      : scenario.id === 'escalate-on-async'
        ? { persistence: 'sticky' }
        : {},
  );
  preview.append(surface);
  livePane.append(preview);
  grid.append(livePane);

  section.append(grid);

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
  const cards = handoffScenarios.map(buildCard);
  // Mount first so every surface connects (scaffold + register listener) before run.
  host.replaceChildren(summary, ...cards.map((c) => c.node));

  for (const card of cards) await card.run();

  summary.className = `summary ${passCount === handoffScenarios.length ? 'pass' : 'fail'}`;
  summary.textContent = `${passCount}/${handoffScenarios.length} invariants hold (producer handoff conformant)`;

  setPlaygroundReady(passCount);
}

void main();
