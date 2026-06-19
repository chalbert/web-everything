/**
 * Unit test for CustomChangeStrategyRegistry — #1107 (webstates completion #1089).
 *
 * Proves per-scope strategy selection: `define`/`active` resolution, nearest-scope-wins inheritance
 * through the `extends` chain (the spec's "a form subtree tracks snapshot-diff while a collaborative
 * subtree tracks crdt"), the native-first fallback, and the `observe()` store helper.
 */
import { describe, it, expect, vi } from 'vitest';
import CustomChangeStrategyRegistry, {
  createDefaultChangeStrategyRegistry,
} from '../../CustomChangeStrategyRegistry';
import {
  nativeChangeStrategy,
  type CustomChangeStrategy,
  type ChangeRecord,
  type Disposable,
} from '../../CustomChangeStrategy';

/** A minimal observational strategy that records track() calls — enough to assert which one is active. */
function fakeStrategy(key: string): CustomChangeStrategy & { tracked: object[] } {
  const tracked: object[] = [];
  return {
    key,
    tracked,
    track(target: object, _emit: (r: ChangeRecord) => void): Disposable {
      tracked.push(target);
      return { dispose: () => {} };
    },
  };
}

describe('CustomChangeStrategyRegistry', () => {
  it('has localName customChangeStrategy and registers strategies by their key', () => {
    const registry = new CustomChangeStrategyRegistry();
    const snapshot = fakeStrategy('snapshot-diff');
    registry.define(snapshot);
    expect(registry.localName).toBe('customChangeStrategy');
    expect(registry.get('snapshot-diff')).toBe(snapshot);
  });

  it('the first defined strategy becomes active; asActive overrides', () => {
    const registry = new CustomChangeStrategyRegistry();
    const a = fakeStrategy('a');
    const b = fakeStrategy('b');
    registry.define(a); // first → active
    expect(registry.active()).toBe(a);
    registry.define(b, true); // explicit active
    expect(registry.active()).toBe(b);
    expect(registry.activeKey).toBe('b');
  });

  it('falls back to the native-first baseline when nothing is selected', () => {
    expect(new CustomChangeStrategyRegistry().active()).toBe(nativeChangeStrategy);
  });

  it('nearest-scope wins: a child inherits the parent strategy, then overrides it', () => {
    const parent = new CustomChangeStrategyRegistry();
    const snapshot = fakeStrategy('snapshot-diff');
    parent.define(snapshot, true);

    // Child scope with no own strategy → inherits the parent's active one (nearest enclosing scope).
    const child = new CustomChangeStrategyRegistry({ extends: [parent] });
    expect(child.active()).toBe(snapshot);

    // Child registers its own crdt strategy → its own selection now wins over the parent's.
    const crdt = fakeStrategy('crdt');
    child.define(crdt, true);
    expect(child.active()).toBe(crdt);
    // Parent is unaffected — the two subtrees track differently in the same app, simultaneously.
    expect(parent.active()).toBe(snapshot);
  });

  it('setActive selects an already-registered strategy without redefining it', () => {
    const registry = new CustomChangeStrategyRegistry();
    const a = fakeStrategy('a');
    const b = fakeStrategy('b');
    registry.define(a, true);
    registry.define(b);
    registry.setActive('b');
    expect(registry.active()).toBe(b);
  });

  it('observe() tracks the target under the active strategy', () => {
    const registry = new CustomChangeStrategyRegistry();
    const strat = fakeStrategy('snapshot-diff');
    registry.define(strat, true);
    const target = { a: 1 };
    const onChange = vi.fn();
    const disposable = registry.observe(target, onChange);
    expect(strat.tracked).toEqual([target]);
    expect(typeof disposable.dispose).toBe('function');
  });

  it('createDefaultChangeStrategyRegistry is pre-loaded with the native strategy active', () => {
    const registry = createDefaultChangeStrategyRegistry();
    expect(registry.active()).toBe(nativeChangeStrategy);
    expect(registry.activeKey).toBe('native-signals');
  });
});
