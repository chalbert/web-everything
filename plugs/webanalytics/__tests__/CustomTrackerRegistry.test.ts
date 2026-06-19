/**
 * Runtime `customTrackers` registry (#1012) — conformance vector for the Analytics protocol seam (#1003).
 *
 * Asserts the registry is a core `CustomRegistry` (injector-chain-resolvable, inheritable via `extends`),
 * that `define`/`resolve` follow the native-first no-op-default convention, and — the behavioral vector —
 * that **identify / track / page / group route through the resolved backend**, with `page` honoring the
 * Segment `(category, name, properties, options)` arg order.
 */
import { describe, it, expect, vi } from 'vitest';
import CustomTrackerRegistry, {
  createDefaultTrackerRegistry,
  UnknownTrackerError,
} from '../CustomTrackerRegistry';
import { NoopTracker, type CustomTracker } from '../../../analytics/provider.js';

/** A backend that records every call, so the vector can assert routing + arg order. */
class SpyTracker implements CustomTracker {
  readonly key = 'spy';
  identify = vi.fn();
  track = vi.fn();
  page = vi.fn();
  group = vi.fn();
}

describe('CustomTrackerRegistry (runtime plug)', () => {
  it('is a core CustomRegistry with the customTrackers localName', () => {
    const registry = new CustomTrackerRegistry();
    expect(registry.localName).toBe('customTrackers');
    expect(typeof registry.has).toBe('function');
    expect(typeof registry.keys).toBe('function');
  });

  it('define(tracker) keys by tracker.key and marks the first as default', () => {
    const registry = new CustomTrackerRegistry();
    registry.define(new NoopTracker());
    expect(registry.has('noop')).toBe(true);
    expect(registry.defaultKey).toBe('noop');
    expect(registry.resolve().key).toBe('noop');
  });

  it('define(tracker, asDefault=true) overrides the default even when not first', () => {
    const registry = new CustomTrackerRegistry();
    registry.define(new NoopTracker());
    registry.define(new SpyTracker(), true);
    expect(registry.defaultKey).toBe('spy');
    expect(registry.resolve().key).toBe('spy');
  });

  it('resolve throws UnknownTrackerError for an unregistered key', () => {
    const registry = createDefaultTrackerRegistry();
    expect(() => registry.resolve('nope')).toThrow(UnknownTrackerError);
  });

  it('createDefaultTrackerRegistry pre-loads the native-first no-op default', () => {
    const registry = createDefaultTrackerRegistry();
    expect(registry.defaultKey).toBe('noop');
    // The no-op default drops calls silently — must not throw.
    expect(() => registry.track('App Opened')).not.toThrow();
  });

  it('routes identify/track/page/group through the resolved backend (Segment page arg order)', () => {
    const registry = createDefaultTrackerRegistry();
    const spy = new SpyTracker();
    registry.define(spy, true);

    registry.identify('u-1', { plan: 'pro' });
    registry.track('Order Completed', { orderId: '50314b8e' });
    registry.page('Docs', 'Pricing', { path: '/pricing' });
    registry.group('acct-9', { name: 'Acme' });

    expect(spy.identify).toHaveBeenCalledWith('u-1', { plan: 'pro' }, undefined);
    expect(spy.track).toHaveBeenCalledWith('Order Completed', { orderId: '50314b8e' }, undefined);
    // category first, then name — the Segment SDK order.
    expect(spy.page).toHaveBeenCalledWith('Docs', 'Pricing', { path: '/pricing' }, undefined);
    expect(spy.group).toHaveBeenCalledWith('acct-9', { name: 'Acme' }, undefined);
  });

  it('routes to a named backend when a trackerKey is passed, leaving others untouched', () => {
    const registry = createDefaultTrackerRegistry();
    const spy = new SpyTracker();
    registry.define(spy);

    registry.track('Explicit', { v: 1 }, undefined, 'spy');
    expect(spy.track).toHaveBeenCalledWith('Explicit', { v: 1 }, undefined);
  });

  it('participates in the injector chain — a child resolves a parent-registered backend via extends', () => {
    const root = createDefaultTrackerRegistry();
    const spy = new SpyTracker();
    root.define(spy);
    const child = new CustomTrackerRegistry({ extends: [root] });
    expect(child.has('spy')).toBe(true);
  });
});
