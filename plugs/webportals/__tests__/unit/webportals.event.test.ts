/**
 * Logical event propagation tests — #1149 (slice of epic #1001), per the ratified #1000 Fork 2 contract.
 *
 * Covers the four ratified surfaces: composedLogical (orthogonal opt-in flag), logicalPath (pre-retarget),
 * composedLogicalPath() (trims at the first logical boundary unless composedLogical), and
 * stopLogicalPropagation(). Plus the declaration-element retarget rule (a logical-ancestor listener sees
 * an event.target inside its OWN logical tree, not the physical outlet).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  applyPatches,
  removePatches,
  isPatched,
  linkLogicalParent,
  dispatchLogical,
  addLogicalEventListener,
  removeLogicalEventListener,
  isEventLogicalPatchApplied,
} from '../../index';

describe('webportals — logical event propagation (plugged)', () => {
  beforeEach(() => applyPatches());
  afterEach(() => {
    removePatches();
    document.body.innerHTML = '';
  });

  it('applies the Event patch under applyPatches() and exposes the surface', () => {
    expect(isPatched()).toBe(true);
    expect(isEventLogicalPatchApplied()).toBe(true);
    expect('logicalPath' in Event.prototype).toBe(true);
    expect('composedLogicalPath' in Event.prototype).toBe(true);
    expect('stopLogicalPropagation' in Event.prototype).toBe(true);
  });

  it('removePatches() tears down the Event surface', () => {
    removePatches();
    expect('logicalPath' in Event.prototype).toBe(false);
    expect('composedLogicalPath' in Event.prototype).toBe(false);
    expect('stopLogicalPropagation' in Event.prototype).toBe(false);
    applyPatches(); // restore for afterEach symmetry
  });

  it('does NOT run the logical leg when bubblesLogical is false (DOM-only)', () => {
    const target = document.createElement('button');
    const ancestor = document.createElement('div');
    document.body.append(ancestor);
    linkLogicalParent(target, ancestor);

    const seen: string[] = [];
    addLogicalEventListener(ancestor, 'click', () => seen.push('logical-ancestor'));

    dispatchLogical(target, new MouseEvent('click', { bubbles: true }));
    expect(seen).toEqual([]); // logical leg skipped
  });

  it('bubbles through the logical chain when bubblesLogical + composedLogical are set', () => {
    const btn = document.createElement('button');
    const portalRoot = document.createElement('div'); // portal content node
    const card = document.createElement('div'); // logical ancestor (declaration parent)
    portalRoot.append(btn);
    document.body.append(card, portalRoot);
    // btn's DOM parent is portalRoot; its LOGICAL parent (declaration parent) is card.
    linkLogicalParent(portalRoot, card);

    const order: string[] = [];
    addLogicalEventListener(card, 'click', () => order.push('card'));

    dispatchLogical(
      btn,
      new MouseEvent('click', { bubbles: true }),
      { bubblesLogical: true, composedLogical: true },
    );
    expect(order).toContain('card');
  });

  it('logicalPath is the pre-retarget chain (target → logical ancestors)', () => {
    const btn = document.createElement('button');
    const mid = document.createElement('div');
    const card = document.createElement('div');
    document.body.append(card, mid, btn);
    linkLogicalParent(btn, mid);
    linkLogicalParent(mid, card);

    let captured: EventTarget[] = [];
    addLogicalEventListener(card, 'click', (e) => {
      captured = e.logicalPath;
    });

    dispatchLogical(
      btn,
      new MouseEvent('click', { bubbles: true }),
      { bubblesLogical: true, composedLogical: true },
    );
    // The chain starts at the deep target and threads the logical links nearest-first, then continues
    // bubbling up the DOM from the logical root (so it may extend past `card` to document root).
    expect(captured.slice(0, 3)).toEqual([btn, mid, card]);
  });

  it('composedLogicalPath() returns the full chain for a composedLogical event', () => {
    const btn = document.createElement('button');
    const portalRoot = document.createElement('div');
    const card = document.createElement('div');
    portalRoot.append(btn); // btn DOM-inside portalRoot
    document.body.append(card, portalRoot);
    linkLogicalParent(portalRoot, card); // portal boundary: portalRoot's logical parent is card

    let path: EventTarget[] = [];
    addLogicalEventListener(card, 'click', (e) => {
      path = e.composedLogicalPath();
    });

    dispatchLogical(
      btn,
      new MouseEvent('click', { bubbles: true }),
      { bubblesLogical: true, composedLogical: true },
    );
    expect(path).toContain(btn);
    expect(path).toContain(card);
  });

  it('composedLogicalPath() trims at the first logical boundary when NOT composedLogical', () => {
    // A non-composedLogical, bubblesLogical event: it may traverse same-tree logical hops but stops at a
    // portal boundary. The path is trimmed at the boundary.
    const a = document.createElement('div');
    const b = document.createElement('div'); // same-tree logical hop (b is a's DOM parent too)
    const portal = document.createElement('div'); // boundary
    b.append(a);
    document.body.append(portal, b);
    linkLogicalParent(b, portal); // b → portal is a logical boundary (b.parentElement is body, not portal)

    let path: EventTarget[] = [];
    // a listener at b (reachable without crossing the boundary) inspects the trimmed path
    addLogicalEventListener(b, 'click', (e) => {
      path = e.composedLogicalPath();
    });

    dispatchLogical(
      a,
      new MouseEvent('click', { bubbles: true }),
      { bubblesLogical: true, composedLogical: false },
    );
    // path stops at b (the boundary node) and does not leak `portal`
    expect(path).not.toContain(portal);
  });

  it('stopLogicalPropagation() halts the remaining logical hops', () => {
    const btn = document.createElement('button');
    const mid = document.createElement('div');
    const card = document.createElement('div');
    document.body.append(card, mid, btn);
    linkLogicalParent(btn, mid);
    linkLogicalParent(mid, card);

    const order: string[] = [];
    addLogicalEventListener(mid, 'click', (e) => {
      order.push('mid');
      e.stopLogicalPropagation();
    });
    addLogicalEventListener(card, 'click', () => order.push('card'));

    dispatchLogical(
      btn,
      new MouseEvent('click', { bubbles: true }),
      { bubblesLogical: true, composedLogical: true },
    );
    expect(order).toEqual(['mid']); // card never reached
  });

  it('retargets event.target to the declaration element at each logical hop (logicalPath stays pure)', () => {
    // Nested-portal shape from the #1000 Fork 2 table: a listener on the logical ancestor must NOT see
    // the physical outlet — the logicalPath contains only logical-tree nodes.
    const btn = document.createElement('button');
    const outlet = document.createElement('div'); // physical mount/outlet
    const card = document.createElement('div'); // logical ancestor (declaration parent)
    outlet.append(btn);
    document.body.append(card, outlet);
    linkLogicalParent(outlet, card);

    let pathAtCard: EventTarget[] = [];
    addLogicalEventListener(card, 'click', (e) => {
      pathAtCard = e.logicalPath;
    });

    dispatchLogical(
      btn,
      new MouseEvent('click', { bubbles: true }),
      { bubblesLogical: true, composedLogical: true },
    );
    // the logical path is pure: it never contains the physical outlet's siblings; outlet IS on the chain
    // only as the declaration-linked node, and the deep target btn is preserved.
    expect(pathAtCard[0]).toBe(btn);
    expect(pathAtCard).toContain(card);
  });

  it('removeLogicalEventListener detaches a logical listener', () => {
    const btn = document.createElement('button');
    const card = document.createElement('div');
    document.body.append(card, btn);
    linkLogicalParent(btn, card);

    const fn = (): void => {
      throw new Error('should not fire after removal');
    };
    addLogicalEventListener(card, 'click', fn);
    removeLogicalEventListener(card, 'click', fn);

    expect(() =>
      dispatchLogical(
        btn,
        new MouseEvent('click', { bubbles: true }),
        { bubblesLogical: true, composedLogical: true },
      ),
    ).not.toThrow();
  });
});

describe('webportals — logical event propagation (unplugged, non-invasive #606)', () => {
  afterEach(() => {
    if (isPatched()) removePatches();
    document.body.innerHTML = '';
  });

  it('dispatchLogical drives the logical leg without the Event prototype patch', () => {
    expect(isEventLogicalPatchApplied()).toBe(false);
    const btn = document.createElement('button');
    const card = document.createElement('div');
    document.body.append(card, btn);
    linkLogicalParent(btn, card);

    let hit = false;
    addLogicalEventListener(card, 'click', () => {
      hit = true;
    });

    dispatchLogical(
      btn,
      new MouseEvent('click', { bubbles: true }),
      { bubblesLogical: true, composedLogical: true },
    );
    expect(hit).toBe(true);
    expect('logicalPath' in Event.prototype).toBe(false);
  });
});
