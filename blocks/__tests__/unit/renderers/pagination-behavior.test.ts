/**
 * Conformance suite for PaginationBehavior — the consumable wrapper over the verified renderer.
 * Asserts that mounting + interacting preserves the a11y/SEO contract (audited by auditPagination),
 * page-button clicks advance the state + fire `pagination-change`, and the wrapper re-implements none
 * of the rendering.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { auditPagination, announcePagination, type PageState, type PaginationOptions } from '../../../renderers/pagination/renderPagination';
import { serializeGolden } from '../../../renderers/pagination/__fixtures__/pagination-goldens';
import { PaginationBehavior, PaginationElement, registerPagination } from '../../../renderers/pagination/PaginationBehavior';

const state: PageState = { pageIndex: 0, pageSize: 50, total: 500, pageCount: 10 };
const options: PaginationOptions = { mode: 'paged', advance: 'manual', urlSync: 'none', rangeLabel: 'range' };

describe('PaginationBehavior', () => {
  let host: HTMLElement;
  beforeEach(() => { host = document.createElement('div'); document.body.append(host); });

  it('renders the audited pagination landmark', () => {
    new PaginationBehavior(host, { state, options });
    // The behavior is a LIVE runtime consumer; the verifier reads a golden as data — serialize this live
    // root into a golden (the capture step), then audit the root against it (the golden-reader path).
    expect(auditPagination(host, serializeGolden('mount', host, options)).ok).toBe(true);
    expect(host.querySelector('nav[aria-label="pagination"]')).toBeTruthy();
  });

  it('clicking a page advances state and fires pagination-change', () => {
    const seen: PageState[] = [];
    new PaginationBehavior(host, { state, options, onChange: (s) => seen.push(s) });
    let fired = 0;
    host.addEventListener('pagination-change', () => fired++);

    // Numbered buttons carry a 1-based data-page; the behavior maps it to the 0-based pageIndex.
    const goto = host.querySelector('[data-action="goto"][data-page="3"]') as HTMLElement | null;
    expect(goto).toBeTruthy();
    goto!.dispatchEvent(new Event('click', { bubbles: true }));

    expect(seen.at(-1)?.pageIndex).toBe(2);
    expect(fired).toBe(1);
    // re-render still passes the audit at the new page (golden-reader over the just-serialized live root)
    expect(auditPagination(host, serializeGolden('after-goto', host, options)).ok).toBe(true);
  });

  it('cursor mode (total, no pageCount) steps next from the current index and clamps via total', () => {
    const seen: PageState[] = [];
    new PaginationBehavior(host, { state: { pageIndex: 0, pageSize: 50, total: 5000 }, options, onChange: (s) => seen.push(s) });
    const next = host.querySelector('[data-action="next"]') as HTMLElement; // cursor mode → no data-page
    expect(next).toBeTruthy();
    next.dispatchEvent(new Event('click', { bubbles: true }));
    expect(seen.at(-1)?.pageIndex).toBe(1);
  });

  it('setTotal recomputes page count and clamps the active page', () => {
    const b = new PaginationBehavior(host, { state: { ...state, pageIndex: 9 }, options });
    b.setTotal(60); // now only 2 pages → page 9 clamps to 1
    expect(b.getState().pageIndex).toBe(1);
    expect(b.getState().pageCount).toBe(2);
  });

  it('announces "Page N of M" on a page change via a persistent polite live region (#326)', () => {
    const b = new PaginationBehavior(host, { state, options });
    const live = host.querySelector('.pagination-live') as HTMLElement;
    expect(live).toBeTruthy();
    expect(live.getAttribute('role')).toBe('status');
    expect(live.getAttribute('aria-live')).toBe('polite');
    expect(live.textContent).toBe(''); // silent on initial mount — only changes announce

    const goto = host.querySelector('[data-action="goto"][data-page="3"]') as HTMLElement;
    goto.dispatchEvent(new Event('click', { bubbles: true }));

    // Same node (not recreated by the re-render) — that is what lets it announce.
    expect(host.querySelector('.pagination-live')).toBe(live);
    expect(live.textContent).toBe(announcePagination(b.getState(), options));
    expect(live.textContent).toBe('Page 3 of 10; Showing 101–150 of 500.');
  });

  it('moves focus to the results heading after a page change (#327, default landing=heading)', () => {
    const results = document.createElement('section');
    const heading = document.createElement('h2');
    heading.textContent = 'Results';
    results.append(heading);
    document.body.append(results);

    new PaginationBehavior(host, { state, options, results });
    (host.querySelector('[data-action="goto"][data-page="2"]') as HTMLElement).dispatchEvent(new Event('click', { bubbles: true }));

    expect(heading.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(heading);
    results.remove();
  });

  it('preserves focus on a load-more change (no landing move — rapid paging)', () => {
    const results = document.createElement('section');
    results.append(document.createElement('h2'));
    document.body.append(results);
    const appendOpts: PaginationOptions = { mode: 'append', advance: 'manual', urlSync: 'none', rangeLabel: 'none' };

    new PaginationBehavior(host, { state: { pageIndex: 0, pageSize: 50, total: 500, pageCount: 10 }, options: appendOpts, results });
    (host.querySelector('[data-action="load-more"]') as HTMLElement).dispatchEvent(new Event('click', { bubbles: true }));

    expect(results.querySelector('h2')!.hasAttribute('tabindex')).toBe(false);
    results.remove();
  });

  it('<page-nav> element drives the behavior from JS properties', () => {
    registerPagination();
    const el = document.createElement('page-nav') as PaginationElement;
    el.options = options;
    el.state = state;
    document.body.append(el);
    expect(el.querySelector('nav[aria-label="pagination"]')).toBeTruthy();
  });
});
