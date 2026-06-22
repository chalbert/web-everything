/**
 * Pagination golden projections — the STORED expected DOM projection per fixture case (the #899
 * vector-conformance model), and the capture step that (re)generates them from the reference renderer.
 *
 * Per ratified #1467 / #899: WE keeps the pagination verifier + vector corpus + types, and that verifier
 * must assert a **stored golden output as data — no live render, no backend recompute**. A golden is the
 * EXPECTED DOM projection captured ONCE as plain JSON-serializable data; `auditPagination`
 * (`../renderPagination.ts`) reads it and asserts a rendered root against it, never re-running
 * `renderPagination`/`rangeText` in the assertion path.
 *
 * This is the pagination sibling of the data-table golden corpus next door
 * (`../../data-table/__fixtures__/data-table-goldens.ts`) and shares its shape: the inputs live in
 * `pagination-cases.ts`, the frozen output lives in `pagination-goldens.json`, and a drift test asserts
 * the committed JSON equals a fresh capture — so the golden bytes are computed once and reviewed in the
 * diff, never hand-guessed, and can never silently go stale. `captureGolden` (which DOES render +
 * serialize) is used ONLY to generate goldens, never in the assertion path.
 */
import {
  renderPagination,
  type PageState,
  type PaginationOptions,
  type PaginationGolden,
  type GoldenCurrentProjection,
} from '../renderPagination';
import { paginationCases } from './pagination-cases';
import goldensJson from './pagination-goldens.json';

export type { PaginationGolden, GoldenCurrentProjection };

/**
 * CAPTURE STEP (generation only — never the assertion path). Render the case via the reference renderer
 * and serialize the rendered root into a `PaginationGolden`. The verifier does NOT call this; it reads
 * the committed `pagination-goldens.json`. This is the one place the reference renderer is authoritative.
 */
export function captureGolden(id: string, state: PageState, opts: PaginationOptions): PaginationGolden {
  return serializeGolden(id, renderPagination(state, opts), opts);
}

/** Serialize an already-rendered pagination root into a golden projection. Pure DOM reads, no recompute. */
export function serializeGolden(id: string, root: HTMLElement, opts: PaginationOptions): PaginationGolden {
  const nav = root.querySelector('nav');
  const sentinel = root.querySelector('[data-role="scroll-sentinel"]');
  const range = root.querySelector('.pagination-range');

  const current: GoldenCurrentProjection[] = Array.from(root.querySelectorAll('[aria-current="page"]')).map((el) => ({
    tag: el.tagName,
    text: el.textContent ?? '',
    href: el.tagName === 'A' ? el.getAttribute('href') : null,
  }));

  return {
    id,
    rootTag: root.tagName,
    mode: opts.mode,
    advance: opts.advance,
    hasNav: !!nav,
    navLabel: nav?.getAttribute('aria-label') ?? null,
    hasSentinel: !!sentinel,
    sentinelAriaHidden: !!sentinel && sentinel.getAttribute('aria-hidden') === 'true',
    current,
    gotoCount: root.querySelectorAll('[data-action="goto"]').length,
    hasRelLink: !!root.querySelector('[rel="next"],[rel="prev"]'),
    rangeText: range?.textContent ?? null,
  };
}

/** Build the complete golden set from the fixture cases — deterministic; the `pagination-goldens.json` source. */
export function buildGoldens(): PaginationGolden[] {
  return paginationCases.map((c) => captureGolden(c.id, c.state, c.opts));
}

/**
 * Reconstruct a pagination root FROM a stored golden — the inverse of {@link serializeGolden}. Lets the
 * conformance test assert the golden output AS DATA (build a root from the committed golden, then run
 * `auditPagination` over it) so the verifier is green WITHOUT a live WE `renderPagination` in the
 * assertion path. It re-materializes exactly the projection the verifier reads (root data-axes, nav +
 * aria-label, scroll sentinel, the active-page marker(s) + their href, jump-to-page controls, range
 * label) — nothing the backend computes.
 */
export function goldenToRoot(golden: PaginationGolden): HTMLElement {
  const root = document.createElement(golden.rootTag.toLowerCase());
  if (golden.rootTag !== 'DIV') return root; // honor a non-div golden verbatim (faithful inverse for negatives)
  root.className = 'pagination';
  root.setAttribute('data-mode', golden.mode);
  root.setAttribute('data-advance', golden.advance);

  if (golden.rangeText != null) {
    const status = document.createElement('p');
    status.className = 'pagination-range';
    status.setAttribute('role', 'status');
    status.textContent = golden.rangeText;
    root.append(status);
  }

  if (golden.hasSentinel) {
    const sentinel = document.createElement('div');
    sentinel.className = 'pagination-sentinel';
    sentinel.setAttribute('data-role', 'scroll-sentinel');
    if (golden.sentinelAriaHidden) sentinel.setAttribute('aria-hidden', 'true');
    root.append(sentinel);
  }

  if (golden.hasNav) {
    const nav = document.createElement('nav');
    if (golden.navLabel != null) nav.setAttribute('aria-label', golden.navLabel);

    // The active-page marker(s) — re-materialize the exact element type the verifier checks. The
    // surrounding numbered links/buttons are not part of the projection (the golden carries only the
    // active control + the jump-to-page count), so emit the active control(s) plus filler goto controls
    // up to the captured count.
    for (const gc of golden.current) {
      const el = gc.tag === 'A' ? document.createElement('a') : document.createElement('button');
      if (gc.tag === 'A') {
        if (gc.href != null) el.setAttribute('href', gc.href);
      } else {
        (el as HTMLButtonElement).setAttribute('type', 'button');
        el.setAttribute('data-action', 'goto');
      }
      el.setAttribute('aria-current', 'page');
      el.textContent = gc.text;
      nav.append(el);
    }

    // Emit any remaining jump-to-page (goto) controls so the rendered count matches the golden. The
    // active control above is itself a goto under urlSync:none; account for that.
    const activeGotos = golden.current.filter((c) => c.tag === 'BUTTON').length;
    for (let i = activeGotos; i < golden.gotoCount; i++) {
      const b = document.createElement('button');
      b.setAttribute('type', 'button');
      b.setAttribute('data-action', 'goto');
      b.textContent = String(i + 1);
      nav.append(b);
    }
    root.append(nav);
  }

  return root;
}

/** The committed, frozen goldens (the assertion source of truth). Keyed access via {@link goldenFor}. */
export const paginationGoldens: readonly PaginationGolden[] = goldensJson as readonly PaginationGolden[];

/** Look up the committed golden for a case id (throws if absent — a missing golden is a corpus gap). */
export function goldenFor(id: string): PaginationGolden {
  const g = paginationGoldens.find((x) => x.id === id);
  if (!g) throw new Error(`No committed pagination golden for case "${id}" — run the capture step.`);
  return g;
}
