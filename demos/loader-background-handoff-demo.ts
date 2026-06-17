/**
 * Loader → Background Task handoff playground (producer side).
 *
 * Wires the **real** producer: a real `ResourceLoader` running `backgroundLoad`
 * escalates into a live receiver when its work crosses the debounce threshold,
 * by dispatching the bubbling `background-task-register` event. Each card auto-runs
 * a deterministic scenario and a badge proves one invariant of the escalation +
 * handoff contract.
 *
 * The receiving end is the WE **reference receiver** (`__fixtures__/reference-receiver`),
 * NOT Frontier UI's `<background-tasks>` surface — the surface is impl, demoed
 * FUI-side. Decoupling onto the reference receiver (per #812 Fork-2(d)) keeps this a
 * demo of the WE-standard producer CONTRACT — the event seam — not of the impl.
 *
 * Scenarios + the controllable-promise lever come from the SHARED fixture module
 * the unit suite imports, so the badges below and CI exercise the same behavior
 * (the demo-first anti-drift split). Native APIs only — no bootstrap, no JSX.
 */

import { setPlaygroundReady } from '/demos/playground-harness';
import { ResourceLoader, backgroundLoad } from '/blocks/resource-loader/index';
import {
  defineReferenceReceiver,
  type ReferenceTaskReceiver,
} from '/blocks/resource-loader/__fixtures__/reference-receiver';
import {
  createDeferred,
  handoffScenarios,
  type HandoffScenario,
} from '/blocks/resource-loader/__fixtures__/handoff-scenarios';

defineReferenceReceiver();

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

const rows = (r: Element) => r.querySelectorAll('.rr-entry');
const stateOf = (r: Element, id: string) =>
  r.querySelector(`.rr-entry[data-task-id="${id}"]`)?.getAttribute('data-state') ?? null;
/** The determinate <progress> value for an entry (null when indeterminate/absent). */
const progressOf = (r: Element, id: string): number | null => {
  const bar = r.querySelector(
    `.rr-entry[data-task-id="${id}"] .rr-progress`,
  ) as HTMLProgressElement | null;
  return bar && bar.position >= 0 ? bar.value : null;
};

/** Build a receiver with a loader target inside it (so the register bubbles up). */
function makeReceiver(): ReferenceTaskReceiver {
  const receiver = document.createElement('reference-task-receiver') as ReferenceTaskReceiver;
  receiver.appendChild(document.createElement('div')); // the loader's target
  return receiver;
}

/** The loader for a card's receiver — its target is the div mounted inside. */
const loaderFor = (receiver: Element) =>
  new ResourceLoader({
    target: receiver.querySelector('div') as HTMLElement,
    timings: { debounced: THRESHOLD_MS },
  });

type Result = { ok: boolean; detail: string };

/** One runner per scenario — drives the real producer and asserts the invariant. */
const runners: Record<string, (r: ReferenceTaskReceiver) => Promise<Result>> = {
  async 'escalate-on-async'(receiver) {
    const loader = loaderFor(receiver);
    const d = createDeferred<string>();
    const p = backgroundLoad(loader, () => d.promise, { id: 'export', label: 'Export data' });

    const beforeThreshold = rows(receiver).length === 0;
    await sleep(THRESHOLD_MS + 40);
    const escalated = stateOf(receiver, 'export') === 'active';

    d.resolve('1,024 rows');
    await p;
    await tick();
    const succeeded = stateOf(receiver, 'export') === 'success';

    return {
      ok: beforeThreshold && escalated && succeeded,
      detail: `pre-empty=${beforeThreshold}, escalated=${escalated}, success=${succeeded}`,
    };
  },

  async 'fast-load-no-escalate'(receiver) {
    const loader = loaderFor(receiver);
    const d = createDeferred<string>();
    const p = backgroundLoad(loader, () => d.promise, { id: 'fast', label: 'Quick fetch' });

    d.resolve('done'); // resolves before the threshold
    const result = await p;
    await sleep(THRESHOLD_MS + 40); // prove nothing escalates late
    const empty = rows(receiver).length === 0;

    return { ok: result.state === 'success' && empty, detail: `result=${result.state}, empty=${empty}` };
  },

  async 'error-then-retry'(receiver) {
    const loader = loaderFor(receiver);
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
    const failedSticky = stateOf(receiver, 'sync') === 'error' && attempts === 1;

    const btn = receiver.querySelector(
      '.rr-entry[data-task-id="sync"] .rr-retry',
    ) as HTMLButtonElement | null;
    btn?.click();
    const reran = attempts === 2;
    await sleep(THRESHOLD_MS + 40);
    const activeAgain = stateOf(receiver, 'sync') === 'active';

    return {
      ok: !!btn && failedSticky && reran && activeAgain,
      detail: `error-sticky=${failedSticky}, retry-reran=${reran}, active-again=${activeAgain}`,
    };
  },

  async 'determinate-progress'(receiver) {
    // A determinate loader: the resolved intent's `progress` drives the receiver's
    // <progress> mode, so reported fractions render as a filling bar.
    const loader = new ResourceLoader({
      target: receiver.querySelector('div') as HTMLElement,
      timings: { debounced: THRESHOLD_MS },
      intent: { progress: 'determinate' },
    });
    const d = createDeferred<string>();
    const p = backgroundLoad(loader, () => d.promise, { id: 'upload', label: 'Upload file' });

    await sleep(THRESHOLD_MS + 40);
    const escalated = stateOf(receiver, 'upload') === 'active';

    loader.reportProgress(256, 1024); // 25% (loaded/total)
    await tick();
    const quarter = progressOf(receiver, 'upload');

    loader.reportProgress(768, 1024); // 75%
    await tick();
    const threeQuarter = progressOf(receiver, 'upload');

    d.resolve('uploaded');
    await p;
    await tick();
    const succeeded = stateOf(receiver, 'upload') === 'success';

    return {
      ok: escalated && quarter === 0.25 && threeQuarter === 0.75 && succeeded,
      detail: `active=${escalated}, 25%=${quarter}, 75%=${threeQuarter}, success=${succeeded}`,
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
  invPane.append(el('pre', 'code', 'backgroundLoad(loader, fn, { id, label })'));
  grid.append(invPane);

  const livePane = el('div', 'pane');
  livePane.append(el('div', 'pane-label', 'Reference receiver'));
  const preview = el('div', 'preview');
  const receiver = makeReceiver();
  preview.append(receiver);
  livePane.append(preview);
  grid.append(livePane);

  section.append(grid);

  const run = async () => {
    const result = await runners[scenario.id](receiver);
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
  // Mount first so every receiver connects (scaffold + register listener) before run.
  host.replaceChildren(summary, ...cards.map((c) => c.node));

  for (const card of cards) await card.run();

  summary.className = `summary ${passCount === handoffScenarios.length ? 'pass' : 'fail'}`;
  summary.textContent = `${passCount}/${handoffScenarios.length} invariants hold (producer handoff conformant)`;

  setPlaygroundReady(passCount);
}

void main();
