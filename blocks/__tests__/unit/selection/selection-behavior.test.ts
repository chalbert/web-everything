/**
 * Conformance suite for SelectionBehavior — the selection-intent runtime.
 * Asserts the contract: single model keeps at most one `aria-selected`, click + arrow keys commit a
 * live selection, a roving tabindex tracks the active item, and `selection-change` fires.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SelectionBehavior, type SelectionChange } from '../../../selection/SelectionBehavior';

function listOf(n: number): HTMLElement {
  const ul = document.createElement('ul');
  for (let i = 0; i < n; i++) {
    const li = document.createElement('li');
    li.setAttribute('role', 'option');
    li.dataset.id = String(i);
    li.textContent = `Item ${i}`;
    ul.append(li);
  }
  document.body.append(ul);
  return ul;
}

describe('SelectionBehavior', () => {
  let host: HTMLElement;
  beforeEach(() => { document.body.innerHTML = ''; host = listOf(4); });

  it('single model: clicking selects exactly one, projecting aria-selected', () => {
    const seen: SelectionChange[] = [];
    const b = new SelectionBehavior(host, { itemSelector: '[role="option"]', onChange: (c) => seen.push(c) });
    const items = [...host.children] as HTMLElement[];
    items[2].dispatchEvent(new Event('click', { bubbles: true }));

    expect(host.querySelectorAll('[aria-selected="true"]').length).toBe(1);
    expect(items[2].getAttribute('aria-selected')).toBe('true');
    expect(b.getSelected()).toEqual([items[2]]);
    expect(seen.at(-1)?.last).toBe(items[2]);

    items[0].dispatchEvent(new Event('click', { bubbles: true })); // moves selection
    expect(host.querySelectorAll('[aria-selected="true"]').length).toBe(1);
    expect(items[0].getAttribute('aria-selected')).toBe('true');
  });

  it('roving tabindex: the active item is the only tabbable one', () => {
    const b = new SelectionBehavior(host, { itemSelector: '[role="option"]' });
    const items = [...host.children] as HTMLElement[];
    expect(items.filter((el) => el.tabIndex === 0).length).toBe(1);
    items[3].dispatchEvent(new Event('click', { bubbles: true }));
    b; // selection commits roving
    expect(items[3].tabIndex).toBe(0);
    expect(items.filter((el) => el.tabIndex === 0).length).toBe(1);
  });

  it('ArrowDown commits a live selection on the next item', () => {
    let fired = 0;
    const b = new SelectionBehavior(host, { itemSelector: '[role="option"]' });
    host.addEventListener('selection-change', () => fired++);
    const items = [...host.children] as HTMLElement[];
    items[0].dispatchEvent(new Event('click', { bubbles: true })); // select first
    items[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(items[1].getAttribute('aria-selected')).toBe('true');
    expect(b.getSelected()).toEqual([items[1]]);
    expect(fired).toBeGreaterThanOrEqual(2);
  });

  it('multiple model toggles independently', () => {
    const b = new SelectionBehavior(host, { itemSelector: '[role="option"]', model: 'multiple' });
    const items = [...host.children] as HTMLElement[];
    items[0].dispatchEvent(new Event('click', { bubbles: true }));
    items[2].dispatchEvent(new Event('click', { bubbles: true }));
    expect(b.getSelected().length).toBe(2);
    items[0].dispatchEvent(new Event('click', { bubbles: true })); // toggle off
    expect(b.getSelected()).toEqual([items[2]]);
  });
});
