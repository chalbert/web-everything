/**
 * DOM-less DI-host (display:contents) demo (#1044) — confirms the layout-neutral provider-element
 * pattern from the DOM-Less Composition research (/research/dom-less-composition/).
 *
 * The problem: in a custom-elements framework every element is a real DOM node, so a `<my-provider>`
 * wrapper inserted to scope dependency injection sits *between* a flex/grid parent and its children and
 * breaks the parent↔child layout relationship (CSS layout pollution). The fix is `display: contents`:
 * the element stays in the **DOM tree** (so the injector chain — which walks DOM ancestors — still
 * resolves a provider declared on it) but contributes **no box** to layout (so its children lay out as
 * if they were direct children of the grandparent). DOM-present, layout-absent — exactly what a DI scope
 * needs.
 *
 * `<di-scope>` is that host: on connect it ensures an injector on itself, provides a context, and sets
 * `display: contents`. The conformance section asserts both halves live; the visual section shows a flex
 * row laying out across the scope boundary, side-by-side with a `display:block` wrapper that breaks it.
 */
import InjectorRoot from '/plugs/webinjectors/InjectorRoot.ts';
import { setPlaygroundReady } from '/demos/playground-harness';

const PROVIDED_KEY = 'customContexts:theme';
const PROVIDED_VALUE = { accent: '#6366f1', name: 'scoped-theme' };

/**
 * A layout-neutral DI scope. It joins the injector tree (a descendant resolves `PROVIDED_KEY` through
 * the chain) but renders `display: contents`, so a flex/grid ancestor treats its children as its own.
 */
class DiScope extends HTMLElement {
  connectedCallback(): void {
    this.style.display = 'contents';
    const root = InjectorRoot.getInjectorRootOf(this) ?? new InjectorRoot();
    if (!InjectorRoot.getInjectorRootOf(this)) root.attach(document);
    const injector = root.ensureInjector(this);
    injector.set(PROVIDED_KEY, PROVIDED_VALUE);
  }
}
if (!customElements.get('di-scope')) customElements.define('di-scope', DiScope);

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

// ── Live fixtures the checks measure against ─────────────────────────────────────────────────────────

/** A flex row whose middle two items are wrapped in a `<di-scope>` — they must still flex as siblings. */
function buildScopedFlexRow(): { row: HTMLElement; inside: HTMLElement; outside: HTMLElement } {
  const outside = el('div', { class: 'flx-item' }, 'A (direct)');
  const inside = el('div', { class: 'flx-item' }, 'C (in scope)');
  const scope = el('di-scope' as 'div'); // custom element; cast for the typed helper
  scope.append(el('div', { class: 'flx-item' }, 'B (in scope)'), inside);
  const row = el('div', { class: 'flx-row' }, outside, scope, el('div', { class: 'flx-item' }, 'D (direct)'));
  return { row, inside, outside };
}

interface Check {
  title: string;
  run(host: HTMLElement): boolean | Promise<boolean>;
}

/**
 * Yield two animation frames so a just-appended custom element is upgraded and laid out before we
 * measure. The plugged webcomponents Element-insertion patch defers `connectedCallback` off the
 * synchronous insertion, so a same-tick read sees the pre-upgrade box — a real frame settles it.
 */
const settle = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

/** Measure the width of the first `.flx-item` of `A` in a 400px flex row built from `children`. */
async function firstItemWidth(host: HTMLElement, ...children: HTMLElement[]): Promise<number> {
  const row = el('div', { class: 'flx-row' }, ...children);
  row.style.width = '400px';
  host.append(row);
  await settle();
  return (row.querySelector('.flx-item') as HTMLElement).getBoundingClientRect().width;
}

const CHECKS: Check[] = [
  {
    title: '<di-scope> computes display:contents (no layout box of its own)',
    run: async (host) => {
      const { row } = buildScopedFlexRow();
      host.append(row);
      await settle();
      const scope = row.querySelector('di-scope') as HTMLElement;
      return getComputedStyle(scope).display === 'contents';
    },
  },
  {
    title: 'a descendant of <di-scope> resolves the provided context through the injector chain',
    run: async (host) => {
      const { row, inside } = buildScopedFlexRow();
      host.append(row);
      await settle();
      // getProvidersOf walks the DOM-ancestor injector chain — display:contents keeps <di-scope> in the
      // tree, so its provider is visible to a descendant.
      return InjectorRoot.getProvidersOf(inside).has(PROVIDED_KEY);
    },
  },
  {
    title: 'an element OUTSIDE the scope does NOT resolve the scoped provider (isolation)',
    run: async (host) => {
      const { row, outside } = buildScopedFlexRow();
      host.append(row);
      await settle();
      return !InjectorRoot.getProvidersOf(outside).has(PROVIDED_KEY);
    },
  },
  {
    title: 'children cross the scope boundary into the flex row (layout-neutral: 4 equal items)',
    run: async (host) => {
      const { row } = buildScopedFlexRow();
      row.style.width = '400px';
      host.append(row);
      await settle();
      // 4 items, all flex:1 — if display:contents works, every item (direct or scoped) gets ~equal width.
      const widths = [...row.querySelectorAll('.flx-item')].map((i) => (i as HTMLElement).getBoundingClientRect().width);
      return widths.length === 4 && Math.max(...widths) - Math.min(...widths) < 2;
    },
  },
  {
    title: 'control: a display:block wrapper BREAKS the row (the scoped A is narrower — pattern is load-bearing)',
    run: async (host) => {
      // Contents scope → 4 flex participants → A ≈ 1/4 of the row. Block wrapper → 3 participants
      // (A, wrap, D) → A ≈ 1/3 of the row, so the block-case A is measurably WIDER. If display:contents
      // did nothing, the two A widths would match.
      const contentsScope = el('di-scope' as 'div');
      contentsScope.append(el('div', { class: 'flx-item' }, 'B'), el('div', { class: 'flx-item' }, 'C'));
      const contentsA = await firstItemWidth(host,
        el('div', { class: 'flx-item' }, 'A'), contentsScope, el('div', { class: 'flx-item' }, 'D'));

      const blockWrap = el('div', { class: 'block-wrap' },
        el('div', { class: 'flx-item' }, 'B'), el('div', { class: 'flx-item' }, 'C'));
      const blockA = await firstItemWidth(host,
        el('div', { class: 'flx-item' }, 'A'), blockWrap, el('div', { class: 'flx-item' }, 'D'));

      return blockA - contentsA >= 10; // fewer flex participants under the block wrapper → wider A
    },
  },
];

async function runConformance(host: HTMLElement): Promise<number> {
  const summary = el('div', { class: 'summary' });
  host.append(summary);
  const sink = el('div', { class: 'measure-sink' }); // off-canvas host for measured fixtures
  host.append(sink);
  let pass = 0;
  for (const check of CHECKS) {
    let ok = false;
    try {
      ok = await check.run(sink);
    } catch {
      ok = false;
    }
    if (ok) pass += 1;
    const card = el('div', { class: 'play-card dl-check' });
    const badge = el('span', { class: `badge ${ok ? 'pass' : 'fail'}` }, ok ? '✓ holds' : '✗ violated');
    card.append(badge, el('span', { class: 'dl-check-title' }, check.title));
    host.append(card);
  }
  summary.className = `summary ${pass === CHECKS.length ? 'pass' : 'fail'}`;
  summary.textContent = `${pass}/${CHECKS.length} dom-less DI-host invariants hold`;
  return pass;
}

/** A visible side-by-side: the display:contents scope (row stays whole) vs a block wrapper (row breaks). */
function renderVisual(host: HTMLElement): void {
  const good = buildScopedFlexRow();
  good.row.classList.add('demo-row');
  const blockWrap = el('div', { class: 'block-wrap' },
    el('div', { class: 'flx-item' }, 'B (wrapped)'), el('div', { class: 'flx-item' }, 'C (wrapped)'));
  const bad = el('div', { class: 'flx-row demo-row' },
    el('div', { class: 'flx-item' }, 'A'), blockWrap, el('div', { class: 'flx-item' }, 'D'));

  host.append(
    el('p', { class: 'dl-label' }, '✓ <di-scope> (display:contents) — A B C D share the flex row'),
    good.row,
    el('p', { class: 'dl-label' }, '✗ <div> wrapper (display:block) — B C are pulled out of the row'),
    bad,
  );
}

function main(): void {
  const root = document.getElementById('play-root');
  if (!root) return;
  root.textContent = '';

  const conformance = el('section', { class: 'dl-card' });
  conformance.append(el('h2', {}, 'Runtime conformance — DOM-present, layout-absent'));
  const passCount = runConformance(conformance);
  root.append(conformance);

  const visual = el('section', { class: 'dl-card' });
  visual.append(el('h2', {}, 'Visual — the scope boundary is invisible to layout'));
  renderVisual(visual);
  root.append(visual);

  setPlaygroundReady(passCount);
}

main();
