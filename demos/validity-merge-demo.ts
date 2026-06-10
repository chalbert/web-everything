/**
 * Validity Merge Playground — drive the runtime `customValidityMerge` plug (#215) live.
 *
 * Bootstrap (loaded first) defines `window.customValidityMerge` (pre-loaded with source-reduction +
 * last-write-wins) and the `<validity-merge-field>` form-associated control. This script builds a
 * control with the four named sources wired to buttons, a strategy switcher, and a live readout — so
 * you can watch independent sources collapse into one `MergedValidity` that drives native
 * `:invalid` / `:user-invalid` via `ElementInternals.setValidity`, and swap the merge math with zero
 * source-feeding edits. Native DOM only; see /demos/validity-merge-demo.html and /plugs/webvalidation/.
 */
import { setPlaygroundReady } from '/demos/playground-harness';
import type { MergedValidity, SourceState } from '/plugs/webvalidation/index.ts';

interface ValidityMergeFieldEl extends HTMLElement {
  setSource(source: string, update: { state: SourceState; message?: string }): MergedValidity;
  clearSource(source: string): MergedValidity;
  useStrategy(key?: string): void;
  readonly merged: MergedValidity | null;
}

const SOURCES = ['native', 'schema', 'async', 'manual'] as const;
const STATES: SourceState[] = ['idle', 'valid', 'invalid', 'pending'];
const STRATEGIES = [
  { key: 'source-reduction', label: 'source-reduction (native-first)' },
  { key: 'last-write-wins', label: 'last-write-wins' },
];

// A canned message per source, used when a source is set invalid.
const INVALID_MESSAGE: Record<string, string> = {
  native: 'Value does not match the native constraint',
  schema: 'Fails the schema rule',
  async: 'Email already taken (server)',
  manual: 'Flagged by the app',
};

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

/** One conformance invariant of the runtime plug — a green badge means the live plug satisfies it. */
interface Check {
  title: string;
  run: () => boolean | Promise<boolean>;
}

/** Mount a detached-but-connected field (so `:invalid`/`:valid` and connectedCallback resolution work). */
function mountField(host: HTMLElement, strategy?: string): ValidityMergeFieldEl {
  const f = document.createElement('validity-merge-field') as unknown as ValidityMergeFieldEl;
  if (strategy) f.setAttribute('strategy', strategy);
  host.appendChild(f);
  return f;
}

const CHECKS: Check[] = [
  {
    title: 'window.customValidityMerge ships source-reduction (default) + last-write-wins',
    run: () => {
      const reg = window.customValidityMerge;
      return (
        !!reg &&
        reg.defaultKey === 'source-reduction' &&
        reg.has('source-reduction') &&
        reg.has('last-write-wins')
      );
    },
  },
  {
    title: 'source-reduction is strictest-wins: any invalid source fails the field',
    run: () => {
      const host = el('div', { hidden: '' });
      document.body.appendChild(host);
      const f = mountField(host);
      f.setSource('native', { state: 'valid' });
      const merged = f.setSource('manual', { state: 'invalid', message: 'no' });
      host.remove();
      return merged.state === 'invalid' && merged.blocking === 'manual';
    },
  },
  {
    title: 'source-reduction: a pending source beats valid ones (not yet decided)',
    run: () => {
      const host = el('div', { hidden: '' });
      document.body.appendChild(host);
      const f = mountField(host);
      f.setSource('native', { state: 'valid' });
      const merged = f.setSource('async', { state: 'pending' });
      host.remove();
      return merged.state === 'pending';
    },
  },
  {
    title: 'last-write-wins swaps the math with the SAME sources (zero control edits)',
    run: () => {
      const host = el('div', { hidden: '' });
      document.body.appendChild(host);
      const f = mountField(host);
      f.setSource('native', { state: 'invalid', message: 'no' });
      const before = f.setSource('manual', { state: 'valid' });
      f.useStrategy('last-write-wins');
      const after = f.merged;
      host.remove();
      // source-reduction → invalid (any invalid fails); last-write-wins → valid (latest write).
      return before.state === 'invalid' && after?.state === 'valid';
    },
  },
  {
    title: 'merged state drives native ElementInternals validity (:invalid / :valid for free)',
    run: () => {
      const host = el('div', { hidden: '' });
      document.body.appendChild(host);
      const f = mountField(host);
      f.setSource('manual', { state: 'invalid', message: 'no' });
      const invalidMatches = (f as unknown as HTMLElement).matches(':invalid');
      f.setSource('manual', { state: 'valid' });
      const validMatches = (f as unknown as HTMLElement).matches(':valid');
      host.remove();
      return invalidMatches && validMatches;
    },
  },
  {
    title: 'per-scope resolution: an injector-scoped registry overrides the global (nearest-wins)',
    run: () => {
      const reg = window.customValidityMerge;
      if (!reg || !window.injectors) return false;
      // A scoped registry that defaults to last-write-wins, set on a wrapper's injector.
      const scoped = new (reg.constructor as new () => typeof reg)();
      (scoped as unknown as { define: (s: unknown, d?: boolean) => void }).define(
        reg.resolve('last-write-wins'),
        true,
      );
      const wrapper = el('div', { hidden: '', injectors: '' });
      document.body.appendChild(wrapper);
      const injector = window.injectors.getInjectorOf(wrapper) ?? window.injectors.ensureInjector(wrapper);
      injector.set('customValidityMerge', scoped as never);
      const f = mountField(wrapper); // no strategy attr → should resolve the scoped default
      f.setSource('native', { state: 'invalid', message: 'no' });
      const merged = f.setSource('manual', { state: 'valid' });
      wrapper.remove();
      // If it resolved the scoped last-write-wins, the latest valid write wins → valid.
      return merged.state === 'valid';
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
    const card = el('div', { class: 'play-card vm-check' });
    const badge = el('span', { class: `badge ${ok ? 'pass' : 'fail'}` }, ok ? '✓ holds' : '✗ violated');
    card.append(badge, el('span', { class: 'vm-check-title' }, check.title));
    host.append(card);
  }
  summary.className = `summary ${pass === CHECKS.length ? 'pass' : 'fail'}`;
  summary.textContent = `${pass}/${CHECKS.length} runtime validity-merge invariants hold`;
  return pass;
}

async function main(): Promise<void> {
  await customElements.whenDefined('validity-merge-field');

  const root = document.getElementById('play-root');
  if (!root) return;
  root.textContent = '';

  // Conformance section — the live plug is asserted against its contract; the e2e smoke reads these.
  const conformance = el('section', { class: 'vm-card' });
  conformance.append(el('h2', {}, 'Runtime conformance'));
  const passCount = await runConformance(conformance);
  root.append(conformance);

  // Track the per-source state buttons so the active one can be highlighted.
  const sourceState: Record<string, SourceState> = {
    native: 'idle',
    schema: 'idle',
    async: 'idle',
    manual: 'idle',
  };

  // ── The live control (left card) ────────────────────────────────────────────
  const field = el('validity-merge-field') as unknown as ValidityMergeFieldEl;
  field.setAttribute('name', 'email');
  field.setAttribute('strategy', 'source-reduction');

  const fieldBox = el('div', { class: 'vm-field' });
  const input = el('input', { type: 'text', placeholder: 'name@example.com', value: 'name@example.com' });
  const hint = el('p', { class: 'vm-hint' });
  fieldBox.append(el('label', {}, 'Email'), input, hint);
  field.append(fieldBox);

  const form = el('form');
  form.append(field);
  const submit = el('div', { class: 'vm-submit' });
  const submitBtn = el('button', { type: 'submit' }, 'Submit form');
  const submitResult = el('p', { class: 'vm-submit-result' });
  submit.append(submitBtn, submitResult);
  form.append(submit);

  const liveCard = el('section', { class: 'vm-card' });
  liveCard.append(el('h2', {}, 'Live control'), form);

  // ── Sources + strategy (also left card, below the control) ──────────────────
  const strategyRow = el('div', { class: 'vm-strategy' });
  strategyRow.append(el('span', {}, 'Merge strategy:'));
  const strategyButtons: HTMLButtonElement[] = [];
  for (const s of STRATEGIES) {
    const btn = el('button', { type: 'button' }, s.label);
    if (s.key === 'source-reduction') btn.classList.add('active');
    btn.addEventListener('click', () => {
      field.useStrategy(s.key);
      strategyButtons.forEach((b) => b.classList.toggle('active', b === btn));
    });
    strategyButtons.push(btn);
    strategyRow.append(btn);
  }

  const sourcesBox = el('div', { class: 'vm-sources' });
  const stateButtons: Record<string, HTMLButtonElement[]> = {};
  for (const source of SOURCES) {
    stateButtons[source] = [];
    const states = el('div', { class: 'vm-states' });
    for (const state of STATES) {
      const btn = el('button', { type: 'button' }, state);
      if (state === 'idle') btn.classList.add('active');
      btn.addEventListener('click', () => {
        sourceState[source] = state;
        if (state === 'idle') field.clearSource(source);
        else field.setSource(source, { state, message: state === 'invalid' ? INVALID_MESSAGE[source] : undefined });
        stateButtons[source].forEach((b) => b.classList.toggle('active', b === btn));
      });
      stateButtons[source].push(btn);
      states.append(btn);
    }
    const row = el('div', { class: 'vm-source' });
    row.append(el('span', {}, source), states);
    sourcesBox.append(row);
  }

  const controlsCard = el('section', { class: 'vm-card' });
  controlsCard.append(
    el('h2', {}, 'Sources & strategy'),
    strategyRow,
    el('p', { class: 'vm-hint' }, 'Set each named source; they collapse into one merged validity below.'),
    sourcesBox,
  );

  // ── Readout (right card) ────────────────────────────────────────────────────
  const readout = el('div', { class: 'vm-readout' });
  const readoutCard = el('section', { class: 'vm-card' });
  readoutCard.append(el('h2', {}, 'Merged validity'), readout);

  function renderReadout(m: MergedValidity | null): void {
    if (!m) {
      readout.textContent = 'No source set yet — the merged state is idle.';
      return;
    }
    const messages = m.messages.length
      ? m.messages.map((x) => `${x.source}: ${x.message}`).join('  ·  ')
      : '—';
    readout.innerHTML = '';
    const stateBadge = el('span', { class: 'vm-badge', 'data-state': m.state }, m.state);
    const dl = el('dl');
    const rows: [string, Node | string][] = [
      ['state', stateBadge],
      ['valid', String(m.valid)],
      ['pending', String(m.pending)],
      ['blocking', m.blocking ?? '—'],
      ['messages', messages],
      ['version', String(m.version)],
    ];
    for (const [k, v] of rows) {
      dl.append(el('dt', {}, k), el('dd', {}, v));
    }
    readout.append(dl);
  }

  function tone(state: SourceState): string {
    return state === 'invalid' ? 'invalid' : state === 'pending' ? 'pending' : state === 'valid' ? 'valid' : '';
  }

  field.addEventListener('validity-merge', (e) => {
    const m = (e as CustomEvent<MergedValidity>).detail;
    renderReadout(m);
    hint.setAttribute('data-tone', tone(m.state));
    hint.textContent =
      m.state === 'invalid'
        ? (m.messages[0]?.message ?? 'Invalid')
        : m.state === 'pending'
          ? 'Validating…'
          : m.state === 'valid'
            ? 'Looks good.'
            : 'Nothing checked yet.';
  });

  // A valid form fires `submit`; an invalid one is blocked by the UA — which instead fires `invalid`
  // on the control and flips it to `:user-invalid`. We surface both paths so the demo shows the
  // platform doing the gating, not the control.
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    submitResult.style.color = '#15803d';
    submitResult.textContent = '✓ Form submitted — every source merged to a non-blocking state.';
  });
  field.addEventListener('invalid', () => {
    submitResult.style.color = '#b91c1c';
    submitResult.textContent =
      '✗ Submission blocked by the platform — the merged validity is invalid/pending, and :user-invalid is now active.';
  });

  // ── Mount ───────────────────────────────────────────────────────────────────
  const grid = el('div', { class: 'vm-grid' });
  const leftCol = el('div');
  leftCol.append(liveCard, controlsCard);
  grid.append(leftCol, readoutCard);
  root.append(grid);

  renderReadout(field.merged);
  setPlaygroundReady(passCount);
}

main();
