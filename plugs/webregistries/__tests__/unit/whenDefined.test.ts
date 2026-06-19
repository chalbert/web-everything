/**
 * Unit test for CustomElementRegistry.whenDefined() (#1101) — a real pending promise.
 *
 * The already-defined fast path resolves immediately; an undefined name returns a pending promise that
 * resolves with the constructor on the next matching define(); multiple waiters all resolve.
 */
import { describe, it, expect } from 'vitest';
import CustomElementRegistry from '../../CustomElementRegistry';

class FooElement extends HTMLElement {}
class BarElement extends HTMLElement {}

describe('CustomElementRegistry.whenDefined() (#1101)', () => {
  it('resolves immediately for an already-defined name (fast path)', async () => {
    const registry = new CustomElementRegistry();
    registry.define('x-foo', FooElement as any);
    await expect(registry.whenDefined('x-foo')).resolves.toBe(FooElement);
  });

  it('resolves a pending promise with the ctor on a later define()', async () => {
    const registry = new CustomElementRegistry();
    const pending = registry.whenDefined('x-bar');
    registry.define('x-bar', BarElement as any);
    await expect(pending).resolves.toBe(BarElement);
  });

  it('settles every waiter for the same name', async () => {
    const registry = new CustomElementRegistry();
    const a = registry.whenDefined('x-baz');
    const b = registry.whenDefined('x-baz');
    registry.define('x-baz', FooElement as any);
    const [ra, rb] = await Promise.all([a, b]);
    expect(ra).toBe(FooElement);
    expect(rb).toBe(FooElement);
  });

  it('no longer rejects with the not-implemented stub error', async () => {
    const registry = new CustomElementRegistry();
    const pending = registry.whenDefined('x-late');
    let rejected = false;
    pending.catch(() => { rejected = true; });
    registry.define('x-late', BarElement as any);
    await expect(pending).resolves.toBe(BarElement);
    expect(rejected).toBe(false);
  });
});
