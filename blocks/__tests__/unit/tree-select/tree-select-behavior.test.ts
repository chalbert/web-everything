import { describe, it, expect, beforeEach } from 'vitest';
import { TreeSelectBehavior, type TreeNode } from '../../../tree-select/TreeSelectBehavior';

const TREE: TreeNode[] = [
  { id: 'liability', label: 'Liability', children: [
    { id: 'bi', label: 'Bodily injury', selectable: true },
    { id: 'pd', label: 'Property damage', selectable: true },
  ] },
  { id: 'collision', label: 'Collision', selectable: true },
  { id: 'addons', label: 'Add-ons', children: [
    { id: 'rental', label: 'Rental', selectable: true },
    { id: 'roadside', label: 'Roadside', selectable: true },
  ] },
];

describe('TreeSelectBehavior', () => {
  let host: HTMLElement;
  beforeEach(() => { document.body.innerHTML = ''; host = document.createElement('div'); document.body.append(host); });

  it('builds a role=tree with APG level/setsize/posinset and expandable parents', () => {
    new TreeSelectBehavior(host, TREE);
    const tree = host.querySelector('ul[role="tree"]')!;
    expect(tree).toBeTruthy();
    const top = [...tree.children].filter((c) => c.getAttribute('role') === 'treeitem');
    expect(top.length).toBe(3);
    expect(top[0].getAttribute('aria-level')).toBe('1');
    expect(top[0].getAttribute('aria-setsize')).toBe('3');
    expect(top[0].getAttribute('aria-posinset')).toBe('1');
    expect(top[0].getAttribute('aria-expanded')).toBe('false'); // collapsed by default
    expect(top[1].getAttribute('aria-checked')).toBe('false');  // selectable leaf
  });

  it('expands a parent (aria-expanded + group unhidden) and reveals children', () => {
    const t = new TreeSelectBehavior(host, TREE, { defaultExpanded: false });
    const liability = host.querySelector('[data-id="liability"]') as HTMLElement;
    (liability.querySelector('[data-toggle]') as HTMLElement).click();
    expect(liability.getAttribute('aria-expanded')).toBe('true');
    expect((liability.querySelector('ul[role="group"]') as HTMLElement).hidden).toBe(false);
    expect(host.querySelector('[data-id="bi"]')).toBeTruthy();
    void t;
  });

  it('toggles selection on a leaf and emits tree-change with the selected ids', () => {
    const seen: string[][] = [];
    host.addEventListener('tree-change', (e) => seen.push((e as CustomEvent).detail.selected));
    const t = new TreeSelectBehavior(host, TREE);
    (host.querySelector('[data-id="collision"] .tree-label') as HTMLElement).click();
    expect((host.querySelector('[data-id="collision"]') as HTMLElement).getAttribute('aria-checked')).toBe('true');
    expect(t.getSelected()).toEqual(['collision']);
    expect(seen.at(-1)).toEqual(['collision']);
  });

  it('cascade: checking a parent checks its descendants; partial reads mixed', () => {
    const t = new TreeSelectBehavior(host, TREE, { cascade: true, defaultExpanded: true });
    const addons = host.querySelector('[data-id="addons"]') as HTMLElement;
    (addons.querySelector('.tree-label') as HTMLElement).click(); // check the parent
    expect(t.getSelected().sort()).toEqual(['rental', 'roadside']);
    expect(addons.getAttribute('aria-checked')).toBe('true');
    // uncheck one child → parent becomes mixed
    (host.querySelector('[data-id="rental"] .tree-label') as HTMLElement).click();
    expect(addons.getAttribute('aria-checked')).toBe('mixed');
  });

  it('single model keeps at most one selected', () => {
    const t = new TreeSelectBehavior(host, TREE, { model: 'single', defaultExpanded: true });
    (host.querySelector('[data-id="bi"] .tree-label') as HTMLElement).click();
    (host.querySelector('[data-id="pd"] .tree-label') as HTMLElement).click();
    expect(t.getSelected()).toEqual(['pd']);
  });

  it('ArrowRight expands a collapsed parent (keyboard)', () => {
    new TreeSelectBehavior(host, TREE);
    const tree = host.querySelector('[role="tree"]') as HTMLElement;
    const first = host.querySelector('[data-id="liability"]') as HTMLElement;
    first.focus();
    tree.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(first.getAttribute('aria-expanded')).toBe('true');
  });
});
