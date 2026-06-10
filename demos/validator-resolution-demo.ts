/**
 * Validator Resolution Playground — drive the runtime `customValidatorResolution` plug (#224) live.
 *
 * Bootstrap (loaded first) defines `window.customValidatorResolution` (pre-loaded with versioning +
 * cancellation), the `<async-validator-field>` driver, and the `<validity-merge-field>` it feeds. This
 * script builds an async field whose validator resolves on a **controllable delay**, so the user can
 * fire overlapping checks and watch the *race*: a slow, now-stale answer arrives last and the active
 * resolution strategy reconciles it — `versioning` lets the request finish then drops the late answer,
 * `cancellation` aborts the in-flight request outright. The surviving answer feeds a composed
 * `<validity-merge-field>`'s `async` source so the merged `:user-invalid` styling reacts live. A
 * strategy switcher swaps the policy with zero field edits (#004 OP-1: vary policy, fix the surface).
 * Native DOM only; see /demos/validator-resolution-demo.html and /plugs/webvalidation/.
 */
import { setPlaygroundReady } from '/demos/playground-harness';
import {
  AsyncValidationRunner,
  type AsyncResult,
  type MergedValidity,
  type SourceState,
} from '/plugs/webvalidation/index.ts';

interface ValidityMergeFieldEl extends HTMLElement {
  setSource(source: string, update: { state: SourceState; message?: string; version?: number }): MergedValidity;
  clearSource(source: string): MergedValidity;
  readonly merged: MergedValidity | null;
}

/** The #224 async driver — feeds a merge field's `async` source under a per-scope resolution strategy. */
interface AsyncValidatorFieldEl extends HTMLElement {
  useValidator(fn: (input: unknown, signal?: AbortSignal) => Promise<AsyncResult>): void;
  useTargetField(target: ValidityMergeFieldEl): void;
  useStrategy(key?: string): void;
  validate(input: unknown): Promise<{ state: string; version: number } | null>;
}

const STRATEGIES = [
  { key: 'versioning', label: 'versioning (native-first default)' },
  { key: 'cancellation', label: 'cancellation' },
];

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const c of children) node.append(c);
  return node;
}

/** The async check under test: after `delay` ms, an input containing `@` is valid, else invalid. */
function emailRule(input: unknown): AsyncResult {
  return String(input).includes('@')
    ? { state: 'valid' }
    : { state: 'invalid', message: `“${String(input)}” is not a valid address (server)` };
}

// ── Conformance: the live plug asserted against the #214 invariants (same source as the unit suite) ──

interface Check {
  title: string;
  run: () => boolean | Promise<boolean>;
}

const CHECKS: Check[] = [
  {
    title: 'window.customValidatorResolution ships versioning (default) + cancellation',
    run: () => {
      const reg = window.customValidatorResolution;
      return !!reg && reg.defaultKey === 'versioning' && reg.has('versioning') && reg.has('cancellation');
    },
  },
  {
    title: 'versioning drops a late answer for superseded input, applies the current generation',
    run: () => {
      const reg = window.customValidatorResolution;
      if (!reg) return false;
      const v = reg.resolve('versioning');
      const stale = v.startValidation('f', 'old'); // generation 1
      const fresh = v.startValidation('f', 'new'); // generation 2 supersedes 1
      // The stale handle's late answer is dropped; the fresh one is applied.
      return v.shouldApplyResult(stale, { state: 'valid' }) === false && v.shouldApplyResult(fresh, { state: 'valid' }) === true;
    },
  },
  {
    title: 'cancellation aborts the prior in-flight request’s signal when a new check starts',
    run: () => {
      const reg = window.customValidatorResolution;
      if (!reg) return false;
      const c = reg.resolve('cancellation');
      const first = c.startValidation('f', 'a');
      const firstSignal = first.signal;
      c.startValidation('f', 'b'); // starting the next check aborts the previous controller
      return firstSignal?.aborted === true && c.shouldApplyResult(first, { state: 'valid' }) === false;
    },
  },
  {
    title: 'the runner emits pending{version} then the terminal valid|invalid (cross-plane contract)',
    run: async () => {
      const reg = window.customValidatorResolution;
      if (!reg) return false;
      const emitted: { state: string; version: number }[] = [];
      const runner = new AsyncValidationRunner(reg.resolve('versioning'), {
        emit: (s) => emitted.push({ state: s.state, version: s.version }),
      });
      const result = await runner.validate('f', 'a@b.com', async () => ({ state: 'valid' }));
      return (
        emitted.length === 2 &&
        emitted[0].state === 'pending' &&
        typeof emitted[0].version === 'number' &&
        emitted[1].state === 'valid' &&
        result?.state === 'valid'
      );
    },
  },
  {
    title: 'overlapping checks: the fresh answer wins, the late stale answer is dropped (the race)',
    run: async () => {
      const reg = window.customValidatorResolution;
      if (!reg) return false;
      const runner = new AsyncValidationRunner(reg.resolve('versioning'));
      let resolveStale: (() => void) | undefined;
      // Fire the slow "old" check first (left pending), then a fast "new" check that resolves now.
      const stale = runner.validate('f', 'old', () => new Promise<AsyncResult>((r) => (resolveStale = () => r({ state: 'invalid' }))));
      const fresh = await runner.validate('f', 'new', async () => ({ state: 'valid' }));
      resolveStale?.(); // the old answer finally arrives — too late
      const staleResult = await stale;
      return fresh?.state === 'valid' && staleResult === null; // late stale answer dropped
    },
  },
  {
    title: 'async-validator-field feeds the surviving answer into a merge field’s async source (#224)',
    run: async () => {
      const host = el('div', { hidden: '' });
      document.body.appendChild(host);
      const field = document.createElement('validity-merge-field') as unknown as ValidityMergeFieldEl;
      host.appendChild(field);
      const asyncEl = document.createElement('async-validator-field') as unknown as AsyncValidatorFieldEl;
      asyncEl.useTargetField(field);
      asyncEl.useValidator(async (input) => emailRule(input));
      host.appendChild(asyncEl);
      const r = await asyncEl.validate('nope'); // async → invalid, blocking the merge
      const invalid = field.merged?.state === 'invalid' && field.merged?.blocking === 'async';
      await asyncEl.validate('a@b.com'); // async → valid
      const valid = field.merged?.state === 'valid';
      host.remove();
      return r?.state === 'invalid' && invalid && valid;
    },
  },
  {
    title: 'per-scope resolution: a scoped customValidatorResolution overrides the global (nearest-wins)',
    run: async () => {
      const reg = window.customValidatorResolution;
      if (!reg || !window.injectors) return false;
      // A scoped registry defaulting to cancellation (the global default is versioning, which has no signal).
      const scoped = new (reg.constructor as new () => typeof reg)();
      (scoped as unknown as { define: (s: unknown, d?: boolean) => void }).define(reg.resolve('cancellation'), true);
      const wrapper = el('div', { hidden: '', injectors: '' });
      document.body.appendChild(wrapper);
      const injector = window.injectors.getInjectorOf(wrapper) ?? window.injectors.ensureInjector(wrapper);
      injector.set('customValidatorResolution', scoped as never);
      const asyncEl = document.createElement('async-validator-field') as unknown as AsyncValidatorFieldEl;
      wrapper.appendChild(asyncEl); // connects → resolves the scoped cancellation strategy
      let firstSignal: AbortSignal | undefined;
      asyncEl.useValidator(
        (_input, signal) =>
          new Promise<AsyncResult>(() => {
            firstSignal ??= signal;
          }),
      );
      void asyncEl.validate('a'); // controller 1
      void asyncEl.validate('b'); // cancellation aborts controller 1 — proves the scoped strategy resolved
      const aborted = firstSignal?.aborted === true;
      wrapper.remove();
      return aborted;
    },
  },
];

async function runConformance(host: HTMLElement): Promise<number> {
  const summary = el('div', { class: 'summary' });
  host.append(summary);
  let pass = 0;
  for (const check of CHECKS) {
    let ok = false;
    try {
      ok = await check.run();
    } catch {
      ok = false;
    }
    if (ok) pass += 1;
    const card = el('div', { class: 'vr-check' });
    const badge = el('span', { class: `badge ${ok ? 'pass' : 'fail'}` }, ok ? '✓ holds' : '✗ violated');
    card.append(badge, el('span', { class: 'vr-check-title' }, check.title));
    host.append(card);
  }
  summary.className = `summary ${pass === CHECKS.length ? 'pass' : 'fail'}`;
  summary.textContent = `${pass}/${CHECKS.length} runtime validator-resolution invariants hold`;
  return pass;
}

// ── The live race surface ────────────────────────────────────────────────────

type Outcome = 'pending' | 'applied' | 'dropped' | 'aborted';

interface RaceEntry {
  outcomeEl: HTMLElement;
  detailEl: HTMLElement;
  settled: boolean;
}

async function main(): Promise<void> {
  await customElements.whenDefined('async-validator-field');
  await customElements.whenDefined('validity-merge-field');

  const root = document.getElementById('play-root');
  if (!root) return;
  root.textContent = '';

  // Conformance section — the live plug asserted against its contract; the e2e smoke reads these.
  const conformance = el('section', { class: 'vr-card' });
  conformance.append(el('h2', {}, 'Runtime conformance'));
  const passCount = await runConformance(conformance);
  root.append(conformance);

  // ── The composed merge field (the async source's destination) ──────────────
  const field = el('validity-merge-field') as unknown as ValidityMergeFieldEl;
  field.setAttribute('name', 'email');
  field.setAttribute('strategy', 'source-reduction');
  const fieldBox = el('div', { class: 'vr-field' });
  const fieldState = el('p', { class: 'vr-hint' }, 'Idle — no async answer yet.');
  fieldBox.append(el('label', {}, 'Composed <validity-merge-field> · async source'), fieldState);
  field.append(fieldBox);

  const form = el('form');
  const submitBtn = el('button', { type: 'submit', class: 'vr-fire-submit' }, 'Submit form');
  const submitResult = el('p', { class: 'vr-hint' });
  form.append(field, submitBtn, submitResult);

  // ── The async driver + its input ───────────────────────────────────────────
  const asyncEl = el('async-validator-field') as unknown as AsyncValidatorFieldEl;
  asyncEl.setAttribute('strategy', 'versioning');
  asyncEl.useTargetField(field);
  const input = el('input', { type: 'text', placeholder: 'name@example.com', value: 'name@example.com' });
  asyncEl.append(input);

  // Delay + fire state shared with the validator (read synchronously when each validate() call starts).
  let armedEntry: RaceEntry | null = null;
  let armedDelayMs = 800;

  function markOutcome(entry: RaceEntry, kind: Outcome, detail: string): void {
    entry.settled = kind !== 'pending';
    entry.outcomeEl.textContent = kind;
    entry.outcomeEl.setAttribute('data-kind', kind);
    entry.detailEl.textContent = detail;
  }

  // The validator: resolves the email rule after the armed delay; respects the abort signal so the
  // cancellation strategy actually tears the request down (not just ignores its answer).
  asyncEl.useValidator(
    (inputValue, signal) =>
      new Promise<AsyncResult>((resolve, reject) => {
        const entry = armedEntry; // captured synchronously, before any await suspends validate()
        const delay = armedDelayMs;
        armedEntry = null;
        const timer = setTimeout(() => resolve(emailRule(inputValue)), delay);
        signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          if (entry) markOutcome(entry, 'aborted', 'request torn down by cancellation strategy');
          reject(new DOMException('aborted', 'AbortError'));
        });
      }),
  );

  const log = el('div', { class: 'vr-log' });
  let genCounter = 0;

  function addLogEntry(value: string, delay: number): RaceEntry {
    const gen = ++genCounter;
    const row = el('div', { class: 'vr-entry' });
    const outcomeEl = el('span', { class: 'vr-outcome', 'data-kind': 'pending' }, 'pending');
    const detailEl = el('span', { class: 'vr-detail' }, `checking “${value}” · ${delay}ms`);
    row.append(el('span', { class: 'vr-gen' }, `#${gen}`), detailEl, outcomeEl);
    log.prepend(row); // newest first
    return { outcomeEl, detailEl, settled: false };
  }

  /** Fire one check; resolves when the runner settles it (applied / dropped / aborted). */
  async function fire(value: string, delay: number): Promise<void> {
    const entry = addLogEntry(value, delay);
    armedEntry = entry;
    armedDelayMs = delay;
    const source = await asyncEl.validate(value);
    if (source) markOutcome(entry, 'applied', `${source.state} (v${source.version}) → applied to async source`);
    else if (!entry.settled) markOutcome(entry, 'dropped', 'stale generation — late answer dropped (versioning)');
  }

  // ── Controls: delay slider, fire buttons, strategy toggle ──────────────────
  const delayInput = el('input', { type: 'range', min: '100', max: '2500', step: '100', value: '800' }) as HTMLInputElement;
  const delayOut = el('output', {}, '800ms');
  delayInput.addEventListener('input', () => {
    armedDelayMs = Number(delayInput.value);
    delayOut.textContent = `${delayInput.value}ms`;
  });
  const delayRow = el('div', { class: 'vr-delay' });
  delayRow.append(el('span', {}, 'validator delay'), delayInput, delayOut);

  const fireRow = el('div', { class: 'vr-fire' });
  const fireOne = el('button', { type: 'button' }, 'Fire one check');
  fireOne.addEventListener('click', () => void fire(input.value, Number(delayInput.value)));
  // The headline: fire a SLOW stale check, then immediately a FAST fresh one, overlapping. The slow
  // answer arrives last — versioning drops it, cancellation aborts it; either way the fresh one wins.
  const fireRace = el('button', { type: 'button' }, 'Fire stale race (slow → fast)');
  fireRace.addEventListener('click', () => {
    const base = Number(delayInput.value);
    void fire('stale value (no @)', base * 2); // slow + would-be-invalid if it ever applied
    void fire(input.value, Math.max(100, Math.round(base / 2))); // fast + fresh
  });
  const clearBtn = el('button', { type: 'button', class: 'secondary' }, 'Clear log');
  clearBtn.addEventListener('click', () => {
    log.textContent = '';
    genCounter = 0;
  });
  fireRow.append(fireOne, fireRace, clearBtn);

  const strategyRow = el('div', { class: 'vr-strategy' });
  strategyRow.append(el('span', {}, 'Resolution strategy:'));
  const strategyButtons: HTMLButtonElement[] = [];
  for (const s of STRATEGIES) {
    const btn = el('button', { type: 'button' }, s.label);
    if (s.key === 'versioning') btn.classList.add('active');
    btn.addEventListener('click', () => {
      asyncEl.useStrategy(s.key); // swap the policy with zero field edits
      strategyButtons.forEach((b) => b.classList.toggle('active', b === btn));
    });
    strategyButtons.push(btn);
    strategyRow.append(btn);
  }

  const controls = el('div', { class: 'vr-controls' });
  controls.append(
    el('p', { class: 'vr-hint' }, 'Type to fire a live check, or use the buttons. Raise the delay, then “Fire stale race” to watch a slow stale answer lose to a fast fresh one.'),
    delayRow,
    fireRow,
  );

  const liveCard = el('section', { class: 'vr-card' });
  liveCard.append(el('h2', {}, 'Live async field'), asyncEl, strategyRow, controls);

  const logCard = el('section', { class: 'vr-card' });
  logCard.append(el('h2', {}, 'Race log'), log);

  // ── Readout (right card): the composed merge field + its async source ──────
  const readout = el('div', { class: 'vr-readout' });
  const readoutCard = el('section', { class: 'vr-card' });
  readoutCard.append(el('h2', {}, 'Merged validity'), form, readout);

  function tone(state: SourceState): string {
    return state === 'invalid' ? 'invalid' : state === 'pending' ? 'pending' : state === 'valid' ? 'valid' : '';
  }

  function renderReadout(m: MergedValidity | null): void {
    if (!m) {
      readout.textContent = 'No async answer yet — the merged state is idle.';
      fieldState.textContent = 'Idle — no async answer yet.';
      fieldState.removeAttribute('data-tone');
      return;
    }
    fieldState.setAttribute('data-tone', tone(m.state));
    fieldState.textContent =
      m.state === 'invalid' ? (m.messages[0]?.message ?? 'Invalid')
      : m.state === 'pending' ? 'Validating…'
      : m.state === 'valid' ? 'Looks good.'
      : 'Nothing checked yet.';
    readout.innerHTML = '';
    const dl = el('dl');
    const rows: [string, Node | string][] = [
      ['state', el('span', { class: 'vr-badge', 'data-state': m.state }, m.state)],
      ['valid', String(m.valid)],
      ['pending', String(m.pending)],
      ['blocking', m.blocking ?? '—'],
      ['version', String(m.version)],
    ];
    for (const [k, v] of rows) dl.append(el('dt', {}, k), el('dd', {}, v));
    readout.append(dl);
  }

  field.addEventListener('validity-merge', (e) => renderReadout((e as CustomEvent<MergedValidity>).detail));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    submitResult.setAttribute('data-tone', 'valid');
    submitResult.textContent = '✓ Form submitted — the surviving async answer merged to a non-blocking state.';
  });
  field.addEventListener('invalid', () => {
    submitResult.setAttribute('data-tone', 'invalid');
    submitResult.textContent = '✗ Submission blocked by the platform — async state is invalid/pending, :user-invalid is now active.';
  });

  // ── Mount ──────────────────────────────────────────────────────────────────
  const grid = el('div', { class: 'vr-grid' });
  const leftCol = el('div');
  leftCol.append(liveCard, logCard);
  grid.append(leftCol, readoutCard);
  root.append(grid);

  renderReadout(field.merged);
  setPlaygroundReady(passCount);
}

main();
