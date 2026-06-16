/**
 * Unplugged-mode (non-invasive) test for webcontexts — #637 / #636 backfill.
 *
 * Proves CustomContext + CustomContextRegistry work as an opt-in library through plain instantiation,
 * WITHOUT the plugged `Node.contexts` global patch (`applyPatches()` is never called, so `isPatched()`
 * stays false and the `Node` prototype is left untouched). The unplugged form is the mandatory real-app
 * surface (#606); this is the automated proof the plug does not REQUIRE plugged mode.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import CustomContextRegistry from '../../CustomContextRegistry';
import CustomContext from '../../CustomContext';
import { isPatched, removePatches } from '../../index';

interface AppState {
  user: string;
  count: number;
}

class AppContext extends CustomContext<AppState> {
  initialValue = { user: 'guest', count: 0 };
}

describe('webcontexts — unplugged (non-invasive) mode', () => {
  let registry: CustomContextRegistry;
  beforeEach(() => {
    registry = new CustomContextRegistry();
  });
  // Defensive: ensure no plugged patch leaked in from a sibling suite.
  afterEach(() => removePatches());

  it('does not patch the Node prototype in unplugged mode (isPatched stays false)', () => {
    registry.define('app', AppContext);
    expect(isPatched()).toBe(false);
    expect('contexts' in (globalThis as any).Node.prototype).toBe(false);
  });

  it('defines and resolves a context constructor through a scoped registry instance', () => {
    registry.define('app', AppContext);
    expect(registry.get('app')).toBe(AppContext);
    expect(registry.getDefinition('app')?.constructor).toBe(AppContext);
  });

  it('runs a context as a plain library — value get/set/has', () => {
    const ctx = new AppContext();
    expect(ctx.get('user')).toBe('guest');
    ctx.set('count', 5);
    expect(ctx.get('count')).toBe(5);
    expect(ctx.has('user')).toBe(true);
  });

  it('keeps two scoped registries independent (non-invasive: no shared global state)', () => {
    const registryB = new CustomContextRegistry();
    registry.define('only-a', AppContext);
    registryB.define('only-b', AppContext);

    expect(registry.get('only-a')).toBe(AppContext);
    expect(registry.get('only-b')).toBeUndefined();
    expect(registryB.get('only-b')).toBe(AppContext);
    expect(registryB.get('only-a')).toBeUndefined();
  });
});
