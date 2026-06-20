/**
 * Portal directive + outlet tests — #1150 (slice of epic #1001), per the ratified #1000 Fork 4
 * contract. Covers present-attach, deferred resolution via the shared document-rooted observer,
 * the `required` synchronous throw, the `disabled` in-place fallback, logical-parent wiring, and the
 * `portal-outlet` ordered list + `portalchange`/`onportalchange`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  applyPatches,
  removePatches,
  definePortalElements,
  PortalDirective,
  PortalOutlet,
  _resetPortalState,
} from '../../index';

/** Flush the MutationObserver microtask queue (jsdom delivers records asynchronously). */
const flush = () => new Promise((r) => setTimeout(r, 0));

/** Build a `<template is="portal-directive">` with the given attributes + content children. */
function makePortal(attrs: Record<string, string>, children: Node[] = []): PortalDirective {
  const portal = new PortalDirective({ children });
  for (const [k, v] of Object.entries(attrs)) portal.setAttribute(k, v);
  return portal;
}

describe('webportals — portal directive + outlet (#1150)', () => {
  beforeEach(() => {
    applyPatches();
    definePortalElements();
  });
  afterEach(() => {
    _resetPortalState();
    // Remove children one-by-one (not innerHTML='') so a portal's disconnectedCallback re-parenting
    // its projected nodes mid-clear doesn't desync the DOM's bulk-removal walk.
    while (document.body.firstChild) document.body.firstChild.remove();
    removePatches();
  });

  it('defines the portal custom elements', () => {
    expect(customElements.get('portal-directive')).toBe(PortalDirective);
    expect(customElements.get('portal-outlet')).toBe(PortalOutlet);
  });

  it('attaches content to an outlet present at connect time', () => {
    const outlet = document.createElement('portal-outlet') as PortalOutlet;
    outlet.id = 'dest';
    document.body.appendChild(outlet);

    const child = document.createElement('span');
    child.textContent = 'hi';
    const portal = makePortal({ target: 'dest' }, [child]);
    document.body.appendChild(portal);

    expect(child.parentElement).toBe(outlet);
    expect(portal.outlet).toBe(outlet);
    expect(outlet.portals.includes(portal)).toBe(true);
  });

  it('sets logicalParent of projected nodes to the declaration element', () => {
    const outlet = document.createElement('portal-outlet') as PortalOutlet;
    outlet.id = 'dest';
    document.body.appendChild(outlet);

    const child = document.createElement('span');
    const portal = makePortal({ target: 'dest' }, [child]);
    document.body.appendChild(portal);

    expect(child.logicalParent).toBe(portal); // physical mount = outlet, logical parent = declaration
  });

  it('defers when the outlet is absent, then attaches once it appears', async () => {
    const child = document.createElement('span');
    const portal = makePortal({ target: 'later' }, [child]);
    document.body.appendChild(portal);

    // No outlet yet → deferred, content not projected.
    expect(child.parentElement).toBeNull();
    expect(portal.outlet).toBeNull();

    const outlet = document.createElement('portal-outlet') as PortalOutlet;
    outlet.id = 'later';
    document.body.appendChild(outlet);
    await flush();

    expect(portal.outlet).toBe(outlet);
    expect(child.parentElement).toBe(outlet);
  });

  it('throws synchronously when a required target is missing', () => {
    const portal = makePortal({ target: 'nope', required: '' }, [document.createElement('span')]);
    expect(() => document.body.appendChild(portal)).toThrowError(/required target "nope"/);
  });

  it('renders in place when disabled (no portalling)', () => {
    const outlet = document.createElement('portal-outlet') as PortalOutlet;
    outlet.id = 'dest';
    document.body.appendChild(outlet);

    const child = document.createElement('span');
    child.textContent = 'inline';
    const portal = makePortal({ target: 'dest', disabled: '' }, [child]);
    document.body.appendChild(portal);

    expect(portal.isInPlace).toBe(true);
    expect(child.parentElement).toBe(document.body); // stayed at the declaration site
    expect(portal.previousSibling === child || portal.nextSibling === child).toBe(true);
    expect(outlet.portals).toHaveLength(0);
  });

  it('withdraws projected nodes and notifies the outlet on disconnect', () => {
    const outlet = document.createElement('portal-outlet') as PortalOutlet;
    outlet.id = 'dest';
    document.body.appendChild(outlet);

    const child = document.createElement('span');
    const portal = makePortal({ target: 'dest' }, [child]);
    document.body.appendChild(portal);
    expect(outlet.portals.includes(portal)).toBe(true);

    portal.remove();

    expect(child.parentElement).not.toBe(outlet);
    expect(child.logicalParent).toBeNull();
    expect(outlet.portals.includes(portal)).toBe(false);
  });

  it('keeps portals ordered and fires portalchange', () => {
    const outlet = document.createElement('portal-outlet') as PortalOutlet;
    outlet.id = 'dest';
    document.body.appendChild(outlet);

    // Count via addEventListener — deterministic across envs (see PortalOutlet's onportalchange note).
    const changes: number[] = [];
    outlet.addEventListener('portalchange', () => changes.push(outlet.portals.length));

    const a = makePortal({ target: 'dest' }, [document.createElement('i')]);
    const b = makePortal({ target: 'dest' }, [document.createElement('b')]);
    document.body.appendChild(a);
    document.body.appendChild(b);

    expect(outlet.portals[0]).toBe(a); // registration (attach) order
    expect(outlet.portals[1]).toBe(b);
    expect(outlet.portals.length).toBe(2);
    expect(changes).toEqual([1, 2]);

    a.remove();
    expect(outlet.portals.length).toBe(1);
    expect(outlet.portals[0]).toBe(b);
    expect(changes).toEqual([1, 2, 1]);
  });

  it('invokes the onportalchange IDL handler', () => {
    const outlet = document.createElement('portal-outlet') as PortalOutlet;
    outlet.id = 'dest';
    document.body.appendChild(outlet);

    let called = false;
    outlet.onportalchange = () => {
      called = true;
    };
    expect(outlet.onportalchange).toBeTypeOf('function');

    document.body.appendChild(makePortal({ target: 'dest' }, [document.createElement('i')]));
    expect(called).toBe(true);

    outlet.onportalchange = null; // clearing detaches the handler
    expect(outlet.onportalchange).toBeNull();
  });

  it('warns at a structural trigger when a deferred portal never resolves', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const portal = makePortal({ target: 'ghost' }, [document.createElement('span')]);
    document.body.appendChild(portal);
    await flush();
    // document.readyState is not "loading" in the test env → rAF/microtask check fires.
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"ghost" never resolved'));
    warn.mockRestore();
  });
});
