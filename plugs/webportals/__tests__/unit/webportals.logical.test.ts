/**
 * Logical-tree polyfill tests — #1148 (foundation slice of epic #1001), per the ratified #1000 contract.
 *
 * Covers BOTH surfaces:
 *   - plugged: the `Element.logicalParent` writable reference + read-only logical-ancestry API;
 *   - unplugged (#606 non-invasive): `getLogicalParent` / `linkLogicalParent` without the prototype patch.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  applyPatches,
  removePatches,
  isPatched,
  getLogicalParent,
  linkLogicalParent,
} from '../../index';

describe('webportals — logical-tree polyfill (plugged)', () => {
  beforeEach(() => applyPatches());
  afterEach(() => {
    removePatches();
    document.body.innerHTML = '';
  });

  it('applies/removes the patch and reports isPatched()', () => {
    expect(isPatched()).toBe(true);
    expect('logicalParent' in Element.prototype).toBe(true);
    removePatches();
    expect(isPatched()).toBe(false);
    expect('logicalParent' in Element.prototype).toBe(false);
    applyPatches(); // restore for afterEach symmetry
  });

  it('logicalParent is a writable element reference', () => {
    const a = document.createElement('div');
    const b = document.createElement('div');
    expect(a.logicalParent).toBeNull();
    a.logicalParent = b;
    expect(a.logicalParent).toBe(b);
  });

  it('reflects the declarative logicalparent="id" IDREF', () => {
    document.body.innerHTML = `<div id="host"></div><div id="child" logicalparent="host"></div>`;
    const host = document.getElementById('host')!;
    const child = document.getElementById('child')!;
    expect(child.logicalParent).toBe(host);
  });

  it('imperative assignment reflects back into the logicalparent attribute', () => {
    const host = document.createElement('div');
    host.id = 'h1';
    document.body.append(host);
    const child = document.createElement('div');
    document.body.append(child);
    child.logicalParent = host;
    expect(child.getAttribute('logicalparent')).toBe('h1');
  });

  it('throws HierarchyRequestError on a direct self-cycle', () => {
    const a = document.createElement('div');
    expect(() => {
      a.logicalParent = a;
    }).toThrowError(/cycle/i);
    try {
      a.logicalParent = a;
    } catch (e) {
      expect((e as DOMException).name).toBe('HierarchyRequestError');
    }
  });

  it('throws HierarchyRequestError on an indirect cycle (descendant becomes parent)', () => {
    const a = document.createElement('div');
    const b = document.createElement('div');
    b.logicalParent = a; // b under a
    expect(() => {
      a.logicalParent = b; // would make a under b — cycle
    }).toThrow();
    try {
      a.logicalParent = b;
    } catch (e) {
      expect((e as DOMException).name).toBe('HierarchyRequestError');
    }
  });

  it('detaches from the prior logical parent on reassignment and fires logicalparentchange', () => {
    const a = document.createElement('div');
    const b = document.createElement('div');
    const c = document.createElement('div');
    const events: any[] = [];
    a.addEventListener('logicalparentchange', (e) => events.push((e as CustomEvent).detail));
    a.logicalParent = b;
    a.logicalParent = c;
    expect(a.logicalParent).toBe(c);
    expect(events).toHaveLength(2);
    expect(events[0].previous).toBeNull();
    expect(events[0].current).toBe(b);
    expect(events[1].previous).toBe(b);
    expect(events[1].current).toBe(c);
  });

  it('clearing to null detaches and fires the change event', () => {
    const a = document.createElement('div');
    const b = document.createElement('div');
    b.id = 'pp';
    document.body.append(b);
    a.logicalParent = b;
    let fired = false;
    a.addEventListener('logicalparentchange', () => (fired = true));
    a.logicalParent = null;
    expect(a.logicalParent).toBeNull();
    expect(fired).toBe(true);
  });

  it('does not fire a spurious change event on a no-op assignment', () => {
    const a = document.createElement('div');
    const b = document.createElement('div');
    a.logicalParent = b;
    let count = 0;
    a.addEventListener('logicalparentchange', () => count++);
    a.logicalParent = b;
    expect(count).toBe(0);
  });

  it('logicalAncestors() yields the logical chain nearest-first', () => {
    const a = document.createElement('div');
    const b = document.createElement('div');
    const c = document.createElement('div');
    a.logicalParent = b;
    b.logicalParent = c;
    expect([...a.logicalAncestors()]).toEqual([b, c]);
  });

  it('isLogicalDescendantOf() reflects logical ancestry, not DOM ancestry', () => {
    const a = document.createElement('div');
    const b = document.createElement('div');
    const c = document.createElement('div');
    a.logicalParent = b;
    b.logicalParent = c;
    expect(a.isLogicalDescendantOf(c)).toBe(true);
    expect(a.isLogicalDescendantOf(document.createElement('div'))).toBe(false);
  });

  it('logicalInjector and logicalAncestors are read-only (no setter)', () => {
    const a = document.createElement('div');
    expect(() => {
      // @ts-expect-error read-only by contract
      a.logicalInjector = {} as any;
    }).toThrow();
  });
});

describe('webportals — unplugged (non-invasive) helpers', () => {
  afterEach(() => {
    if (isPatched()) removePatches();
  });

  it('getLogicalParent/linkLogicalParent work without the prototype patch', () => {
    expect(isPatched()).toBe(false);
    const a = document.createElement('div');
    const b = document.createElement('div');
    linkLogicalParent(a, b);
    expect(getLogicalParent(a)).toBe(b);
    expect('logicalParent' in Element.prototype).toBe(false);
  });

  it('linkLogicalParent enforces the cycle guard', () => {
    const a = document.createElement('div');
    expect(() => linkLogicalParent(a, a)).toThrow();
    try {
      linkLogicalParent(a, a);
    } catch (e) {
      expect((e as DOMException).name).toBe('HierarchyRequestError');
    }
  });

  it('getLogicalParent resolves the declarative IDREF without patching', () => {
    document.body.innerHTML = `<div id="uh"></div><div id="uc" logicalparent="uh"></div>`;
    const host = document.getElementById('uh')!;
    const child = document.getElementById('uc')!;
    expect(getLogicalParent(child)).toBe(host);
    document.body.innerHTML = '';
  });
});
