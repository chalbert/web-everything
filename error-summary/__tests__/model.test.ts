/**
 * Error-summary model tests (#1114) — the pure GOV.UK aggregation (DOM-ordered + field-link), DOM-free
 * (it takes a live root for ordering only). Verifies set/clear, DOM ordering by target position, and the
 * detached-target stability.
 */
import { describe, it, expect } from 'vitest';
import { ErrorSummaryModel } from '../model';

function root(html: string): HTMLElement {
  const d = document.createElement('div');
  d.innerHTML = html;
  return d;
}

describe('ErrorSummaryModel (#1114)', () => {
  it('set/clear track field errors', () => {
    const m = new ErrorSummaryModel();
    expect(m.hasErrors).toBe(false);
    m.set({ fieldId: 'a', message: 'A bad', targetId: 'a' });
    expect(m.hasErrors).toBe(true);
    expect(m.clear('a')).toBe(true);
    expect(m.hasErrors).toBe(false);
    expect(m.clear('a')).toBe(false);
  });

  it('orders entries by DOM position of their target, not insertion order', () => {
    const m = new ErrorSummaryModel();
    // insert b then a, but a appears before b in the DOM
    m.set({ fieldId: 'b', message: 'B bad', targetId: 'b' });
    m.set({ fieldId: 'a', message: 'A bad', targetId: 'a' });
    const r = root('<div id="a"></div><div id="b"></div>');
    expect(m.ordered(r).map((e) => e.fieldId)).toEqual(['a', 'b']);
  });

  it('a target not present in the root sorts after located entries (stable)', () => {
    const m = new ErrorSummaryModel();
    m.set({ fieldId: 'ghost', message: 'gone', targetId: 'ghost' });
    m.set({ fieldId: 'a', message: 'A bad', targetId: 'a' });
    const r = root('<div id="a"></div>');
    expect(m.ordered(r).map((e) => e.fieldId)).toEqual(['a', 'ghost']);
  });

  it('targetId defaults to fieldId when omitted', () => {
    const m = new ErrorSummaryModel();
    m.set({ fieldId: 'x', message: 'm', targetId: '' });
    expect(m.entries[0].targetId).toBe('x');
  });
});
