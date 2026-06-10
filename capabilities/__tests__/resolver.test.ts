/**
 * Native-first resolver (#205) — unit + the DoD demonstration of **both branches**:
 *   - native branch: a droplist slot set to `native-first` resolves to the native `base-select` impl
 *     where every required capability is native-ok/polyfill-ok (the shipped build-matrix);
 *   - fallback branch: against a constrained-target provider where a required capability is
 *     capability-hard on the native substrate, the same policy falls through to the custom FACE impl.
 * Plus the algorithm's three rules in isolation: eligible (check-before-choose), lightest, and
 * native-wins-ties — and that a concrete pin short-circuits resolution.
 */
import { describe, it, expect } from 'vitest';
import { StaticMatrixProvider, type CapabilityMatrix } from '../provider.js';
import {
  resolveSlot,
  evaluate,
  pickNativeFirst,
  requiredCapabilitiesFor,
  isPin,
  isPolicy,
  NoEligibleImplError,
  UnknownPolicyError,
} from '../resolver.js';
import { createDefaultProvider } from '../index.js';

const NATIVE_FIRST = { policy: 'native-first' } as const;

describe('slot shape', () => {
  it('distinguishes a concrete pin from a named policy', () => {
    expect(isPin('base-select')).toBe(true);
    expect(isPolicy('base-select')).toBe(false);
    expect(isPolicy(NATIVE_FIRST)).toBe(true);
    expect(isPin(NATIVE_FIRST)).toBe(false);
  });

  it('a pinned slot short-circuits — returns the impl as-is, no resolution', () => {
    const provider = createDefaultProvider();
    const r = resolveSlot(provider, 'face', ['selection', 'anchor']);
    expect(r).toMatchObject({ impl: 'face', policy: null, pinned: true, candidates: [] });
  });
});

describe('native-first DoD — native branch (shipped build-matrix)', () => {
  const provider = createDefaultProvider();

  it('a droplist slot resolves to the native base-select impl', () => {
    const r = resolveSlot(provider, NATIVE_FIRST, ['selection', 'anchor']);
    expect(r.impl).toBe('base-select');
    expect(r.pinned).toBe(false);
    expect(r.policy).toBe('native-first');
    // base-select is eligible (no capability-hard); FACE is not (customizable-select is hard).
    const face = r.candidates.find((c) => c.impl === 'face')!;
    const baseSelect = r.candidates.find((c) => c.impl === 'base-select')!;
    expect(baseSelect.eligible).toBe(true);
    expect(face.eligible).toBe(false);
    expect(face.blockers).toContain('customizable-select');
  });

  it('check-before-choose: FACE is rejected for the hard wall even before lightness is weighed', () => {
    // selection requires customizable-select, which is capability-hard on FACE → never eligible.
    const required = requiredCapabilitiesFor(provider, ['selection']);
    expect(required).toContain('customizable-select');
    const reports = evaluate(provider, required);
    expect(reports.find((c) => c.impl === 'face')!.eligible).toBe(false);
  });
});

describe('native-first DoD — fallback branch (constrained-target provider)', () => {
  // A constrained target (the kind #208's runtime/edge providers report): the native substrate can
  // no longer serve anchor-positioning even via polyfill, but the custom FACE impl still can. Same
  // algorithm, different provider — native-first falls through to FACE.
  const CONSTRAINED: CapabilityMatrix = {
    impls: [
      {
        id: 'base-select',
        label: 'base-select',
        native: true,
        summary: '',
        tiers: { 'anchor-positioning': 'capability-hard', popover: 'native-ok' },
      },
      {
        id: 'face',
        label: 'FACE',
        summary: '',
        tiers: { 'anchor-positioning': 'polyfill-ok', popover: 'native-ok' },
      },
    ],
  };
  const provider = new StaticMatrixProvider(CONSTRAINED, { anchor: ['anchor-positioning', 'popover'] });

  it('falls to the custom FACE impl where a required capability is capability-hard on native', () => {
    const r = resolveSlot(provider, NATIVE_FIRST, ['anchor']);
    expect(r.impl).toBe('face');
    const baseSelect = r.candidates.find((c) => c.impl === 'base-select')!;
    expect(baseSelect.eligible).toBe(false);
    expect(baseSelect.blockers).toEqual(['anchor-positioning']);
  });

  it('throws NoEligibleImplError when the hard wall hits every impl', () => {
    const allHard: CapabilityMatrix = {
      impls: [
        { id: 'base-select', label: '', native: true, summary: '', tiers: { 'customizable-select': 'capability-hard' } },
        { id: 'face', label: '', summary: '', tiers: { 'customizable-select': 'capability-hard' } },
      ],
    };
    const p = new StaticMatrixProvider(allHard, { selection: ['customizable-select'] });
    expect(() => resolveSlot(p, NATIVE_FIRST, ['selection'])).toThrow(NoEligibleImplError);
  });
});

describe('native-first algorithm — lightest, then native wins ties', () => {
  const matrix: CapabilityMatrix = {
    impls: [
      // heavy: 2 polyfills, eligible
      { id: 'heavy', label: '', summary: '', tiers: { a: 'polyfill-ok', b: 'polyfill-ok' } },
      // light-custom: 1 polyfill, not native
      { id: 'light-custom', label: '', summary: '', tiers: { a: 'polyfill-ok', b: 'native-ok' } },
      // light-native: 1 polyfill, native (ties light-custom on cost)
      { id: 'light-native', label: '', native: true, summary: '', tiers: { a: 'polyfill-ok', b: 'native-ok' } },
    ],
  };
  const provider = new StaticMatrixProvider(matrix, { x: ['a', 'b'] });

  it('lightest wins: heavy (2 polyfills) loses to the 1-polyfill impls', () => {
    const reports = evaluate(provider, ['a', 'b']);
    expect(reports.find((c) => c.impl === 'heavy')!.cost).toBe(2);
    expect(pickNativeFirst(reports)!.cost).toBe(1);
  });

  it('native wins the lightness tie: light-native beats light-custom', () => {
    const r = resolveSlot(provider, NATIVE_FIRST, ['x']);
    expect(r.impl).toBe('light-native');
    expect(r.reason).toContain('native wins the tie');
  });
});

describe('errors', () => {
  it('throws UnknownPolicyError for an unrecognized policy', () => {
    const provider = createDefaultProvider();
    expect(() => resolveSlot(provider, { policy: 'bleeding-edge-first' as 'native-first' }, ['selection'])).toThrow(
      UnknownPolicyError,
    );
  });

  it('requiredCapabilitiesFor unions intents order-stable and de-duplicated', () => {
    const provider = createDefaultProvider();
    // validation and modal both require `dialog`-adjacent caps; union must not duplicate.
    const caps = requiredCapabilitiesFor(provider, ['modal', 'modal']);
    expect(caps).toEqual([...new Set(caps)]);
  });
});
