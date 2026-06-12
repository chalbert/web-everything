/**
 * Unit tests for the MaaS reactivity model (backlog #310) — lifecycle callbacks, effects, and the
 * swappable change-detection seam. Proves reactivity is an opt-in strategy beside MaaS, not baked in:
 * the change detector is the gate (no detected change → nothing fires), and a custom detector drops in
 * through the same registry seam as the compiler.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  dirtyCheckDetector,
  CustomChangeDetectorRegistry,
  createDefaultChangeDetectorRegistry,
  UnknownChangeDetectorError,
  ReactiveController,
  type ChangeDetector,
  type Effect,
} from '../../../renderers/module-service/reactivity';

describe('dirtyCheckDetector', () => {
  it('detects added, removed, and mutated keys (union, Object.is)', () => {
    expect(dirtyCheckDetector.detect({ a: 1 }, { a: 1 })).toEqual([]);
    expect(dirtyCheckDetector.detect({ a: 1 }, { a: 2 }).sort()).toEqual(['a']);
    expect(dirtyCheckDetector.detect({ a: 1 }, { a: 1, b: 2 }).sort()).toEqual(['b']);
    expect(dirtyCheckDetector.detect({ a: 1, b: 2 }, { a: 1 }).sort()).toEqual(['b']);
  });
});

describe('CustomChangeDetectorRegistry', () => {
  it('preloads dirty-check as the native-first default', () => {
    const registry = createDefaultChangeDetectorRegistry();
    expect(registry.localName).toBe('customChangeDetector');
    expect(registry.defaultId).toBe('dirty-check');
    expect(registry.resolve()).toBe(dirtyCheckDetector);
    expect(registry.resolve('dirty-check')).toBe(dirtyCheckDetector);
  });

  it('accepts a sibling detector and never silently substitutes an unknown one', () => {
    const registry = createDefaultChangeDetectorRegistry();
    const deep: ChangeDetector = { id: 'deep', detect: () => ['x'] };
    registry.register(deep);
    expect(registry.keys()).toEqual(['dirty-check', 'deep']);
    expect(registry.resolve('deep')).toBe(deep);
    expect(() => registry.resolve('nope')).toThrow(UnknownChangeDetectorError);
  });

  it('throws on resolve when the registry is empty (no default)', () => {
    expect(() => new CustomChangeDetectorRegistry().resolve()).toThrow(UnknownChangeDetectorError);
  });
});

describe('ReactiveController', () => {
  it('fires onMount and runs every effect once at mount', () => {
    const onMount = vi.fn();
    const eff = vi.fn();
    const c = new ReactiveController({
      initialState: { n: 0 },
      lifecycle: { onMount },
      effects: [{ deps: ['n'], run: eff }],
    });
    c.mount();
    c.mount(); // idempotent
    expect(onMount).toHaveBeenCalledTimes(1);
    expect(eff).toHaveBeenCalledTimes(1);
  });

  it('change detection gates updates — a no-op setState fires nothing', () => {
    const onUpdate = vi.fn();
    const eff = vi.fn();
    const c = new ReactiveController({
      initialState: { n: 0, other: 'x' },
      lifecycle: { onUpdate },
      effects: [{ deps: ['n'], run: eff }],
    });
    c.mount();
    eff.mockClear();

    expect(c.setState({ n: 0 })).toEqual([]); // unchanged → no fire
    expect(onUpdate).not.toHaveBeenCalled();
    expect(eff).not.toHaveBeenCalled();

    expect(c.setState({ n: 1 })).toEqual(['n']); // changed → fires onUpdate + the n-effect
    expect(onUpdate).toHaveBeenCalledWith(['n'], { n: 1, other: 'x' });
    expect(eff).toHaveBeenCalledTimes(1);
  });

  it('only re-runs an effect when one of ITS deps changed', () => {
    const nEff = vi.fn();
    const otherEff = vi.fn();
    const c = new ReactiveController({
      initialState: { n: 0, other: 'a' },
      effects: [{ deps: ['n'], run: nEff }, { deps: ['other'], run: otherEff }],
    });
    c.mount();
    nEff.mockClear();
    otherEff.mockClear();

    c.setState({ other: 'b' });
    expect(nEff).not.toHaveBeenCalled();
    expect(otherEff).toHaveBeenCalledTimes(1);
  });

  it('runs an effect cleanup before re-running it and again at unmount', () => {
    const cleanup = vi.fn();
    const effect: Effect = { deps: ['n'], run: () => cleanup };
    const c = new ReactiveController({ initialState: { n: 0 }, effects: [effect] });
    c.mount();
    expect(cleanup).not.toHaveBeenCalled();

    c.setState({ n: 1 }); // re-run → previous cleanup fires first
    expect(cleanup).toHaveBeenCalledTimes(1);

    c.unmount();
    expect(cleanup).toHaveBeenCalledTimes(2); // unmount runs the latest cleanup
  });

  it('uses an injected detector (reactivity is a swappable strategy)', () => {
    // A detector that ignores `internal` keys — proving the comparison policy is pluggable.
    const ignoreInternal: ChangeDetector = {
      id: 'ignore-internal',
      detect: (prev, next) =>
        Object.keys(next).filter((k) => !k.startsWith('_') && !Object.is(prev[k], next[k])),
    };
    const onUpdate = vi.fn();
    const c = new ReactiveController({ initialState: { v: 1, _tick: 0 }, lifecycle: { onUpdate }, detector: ignoreInternal });
    c.mount();
    expect(c.setState({ _tick: 99 })).toEqual([]); // ignored by the custom policy
    expect(onUpdate).not.toHaveBeenCalled();
    expect(c.setState({ v: 2 })).toEqual(['v']);
  });
});
