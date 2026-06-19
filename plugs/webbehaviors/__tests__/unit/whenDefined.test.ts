/**
 * Unit test for CustomAttributeRegistry.whenDefined(name) (#1119, spec njk:113).
 *
 * The spec-required promise: resolves immediately if the name is already defined; otherwise settles on the
 * next define(name, …) — including the lazy path, since defineLazy resolves through define() on load
 * completion. Never rejects (unlike the webregistries stub the spec warns off).
 */
import { describe, it, expect } from 'vitest';
import CustomAttributeRegistry from '../../CustomAttributeRegistry';
import CustomAttribute from '../../CustomAttribute';

class MyAttribute extends CustomAttribute {}
class LazyAttribute extends CustomAttribute {}

describe('CustomAttributeRegistry.whenDefined (#1119)', () => {
  it('resolves synchronously when the name is already defined', async () => {
    const registry = new CustomAttributeRegistry();
    registry.define('my-attr', MyAttribute as any);
    const ctor = await registry.whenDefined('my-attr');
    expect(ctor).toBe(MyAttribute);
  });

  it('resolves on a LATER define(name, …)', async () => {
    const registry = new CustomAttributeRegistry();
    const promise = registry.whenDefined('later-attr');
    let resolved = false;
    promise.then(() => { resolved = true; });
    // not yet defined → still pending
    await Promise.resolve();
    expect(resolved).toBe(false);

    registry.define('later-attr', MyAttribute as any);
    const ctor = await promise;
    expect(ctor).toBe(MyAttribute);
  });

  it('multiple awaiters for the same name all resolve on define()', async () => {
    const registry = new CustomAttributeRegistry();
    const a = registry.whenDefined('multi-attr');
    const b = registry.whenDefined('multi-attr');
    registry.define('multi-attr', MyAttribute as any);
    expect(await a).toBe(MyAttribute);
    expect(await b).toBe(MyAttribute);
  });

  it('resolves on lazy-load completion (defineLazy → load → define)', async () => {
    const registry = new CustomAttributeRegistry();
    let loaded = false;
    registry.defineLazy('lazy-attr', async () => {
      loaded = true;
      return LazyAttribute as any;
    });
    const promise = registry.whenDefined('lazy-attr');
    // Trigger the lazy load through the registry's public preload() path (the lazy chunk fetch + define()).
    await registry.preload('lazy-attr');
    const ctor = await promise;
    expect(ctor).toBe(LazyAttribute);
    expect(loaded).toBe(true);
  });
});
