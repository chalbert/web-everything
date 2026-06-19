/**
 * Unplugged-mode (non-invasive) test for webanalytics — #606 / #636 dual-mode proof (#1012).
 *
 * Proves the runtime `customTrackers` plug works as an opt-in library through plain instantiation,
 * WITHOUT any global patch — importing `webanalytics` installs nothing (the module only logs on load;
 * the registry is a plain `CustomRegistry` and backends are pure). The non-invasive proof: a
 * `CustomTrackerRegistry` built standalone resolves the native-first no-op default and routes a call,
 * and two scoped registries stay fully independent (no shared global state). The unplugged form is the
 * mandatory real-app surface (#606); this is the automated proof the plug does not REQUIRE plugged mode.
 */
import { describe, it, expect, vi } from 'vitest';
import CustomTrackerRegistry, { createDefaultTrackerRegistry } from '../../CustomTrackerRegistry';
import { NoopTracker, type CustomTracker } from '../../../../analytics/provider.js';

class SpyTracker implements CustomTracker {
  readonly key = 'spy';
  identify = vi.fn();
  track = vi.fn();
  page = vi.fn();
  group = vi.fn();
}

describe('webanalytics — unplugged (non-invasive) mode', () => {
  it('defines and resolves a backend through a standalone registry instance (no global patch)', () => {
    const registry = new CustomTrackerRegistry();
    registry.define(new NoopTracker());
    expect(registry.has('noop')).toBe(true);
    expect(registry.resolve().key).toBe('noop');
  });

  it('runs as a plain library — the native-first no-op default drops a call silently', () => {
    const registry = createDefaultTrackerRegistry();
    expect(registry.defaultKey).toBe('noop');
    expect(() => registry.track('App Opened')).not.toThrow();
  });

  it('routes a call through a resolved backend with no global patch', () => {
    const registry = createDefaultTrackerRegistry();
    const spy = new SpyTracker();
    registry.define(spy, true);
    registry.track('Order Completed', { orderId: '50314b8e' });
    expect(spy.track).toHaveBeenCalledWith('Order Completed', { orderId: '50314b8e' }, undefined);
  });

  it('keeps two scoped registries independent (non-invasive: no shared global state)', () => {
    const registryA = new CustomTrackerRegistry();
    const registryB = new CustomTrackerRegistry();
    registryA.define(new NoopTracker());
    registryB.define(new SpyTracker());

    expect(registryA.resolve().key).toBe('noop');
    expect(registryB.resolve().key).toBe('spy');
    expect(registryA.has('spy')).toBe(false);
    expect(registryB.has('noop')).toBe(false);
  });
});
