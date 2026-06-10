/**
 * Resolution venues (#208) — the configurable where/when dimension and its shared `degrade` primitive:
 *   - `degrade` lowers an architectural ceiling by live platform reality (the full truth table);
 *   - `DegradingProvider` overrides only `tier()`, deferring every structural question to the base;
 *   - `providerForVenue` routes `build` → static, `runtime`/`edge` → degraded;
 *   - `resolveAtVenue` runs the UNCHANGED #205 resolver in every venue — only the tiers differ.
 */
import { describe, it, expect } from 'vitest';
import { StaticMatrixProvider, type Capability, type CapabilityMatrix } from '../provider.js';
import {
  degrade,
  DegradingProvider,
  providerForVenue,
  resolveAtVenue,
  VENUES,
  DEFAULT_VENUE,
  type PlatformSupport,
} from '../venues.js';

const NATIVE_FIRST = { policy: 'native-first' } as const;

// A tiny vocabulary spanning the three polyfill classes that drive `degrade`.
const VOCAB: Capability[] = [
  { id: 'popover', label: '', webFeaturesKey: 'popover', baseline: '2024', polyfill: 'polyfillable', summary: '' },
  { id: 'cross-root-aria', label: '', webFeaturesKey: 'cross-root-aria', baseline: false, polyfill: 'partial', summary: '' },
  { id: 'customizable-select', label: '', webFeaturesKey: 'customizable-select', baseline: false, polyfill: 'capability', summary: '' },
];

// base-select is native everywhere; face shims popover but walls the privileged select.
const MATRIX: CapabilityMatrix = {
  impls: [
    {
      id: 'base-select',
      label: 'base-select',
      native: true,
      summary: '',
      tiers: { popover: 'native-ok', 'cross-root-aria': 'native-ok', 'customizable-select': 'native-ok' },
    },
    {
      id: 'face',
      label: 'FACE',
      summary: '',
      tiers: { popover: 'native-ok', 'cross-root-aria': 'capability-hard', 'customizable-select': 'capability-hard' },
    },
  ],
};
const INTENT_MAP = { selection: ['customizable-select', 'popover'], anchor: ['popover'] };
const base = new StaticMatrixProvider(MATRIX, INTENT_MAP);

describe('venue dimension', () => {
  it('lists the three venues with build as the default', () => {
    expect(VENUES).toEqual(['build', 'runtime', 'edge']);
    expect(DEFAULT_VENUE).toBe('build');
  });
});

describe('degrade — lower an architectural ceiling by live platform reality', () => {
  it('undefined support → trust the matrix (fall back to static, #204)', () => {
    expect(degrade('native-ok', undefined, 'polyfillable')).toBe('native-ok');
    expect(degrade('polyfill-ok', undefined, 'capability')).toBe('polyfill-ok');
  });

  it('supported → the ceiling stands unchanged', () => {
    expect(degrade('native-ok', true, 'polyfillable')).toBe('native-ok');
    expect(degrade('native-ok', true, 'capability')).toBe('native-ok');
  });

  it('absent + native-ok → degrades by polyfill class', () => {
    expect(degrade('native-ok', false, 'polyfillable')).toBe('polyfill-ok'); // a shim recovers it
    expect(degrade('native-ok', false, 'partial')).toBe('polyfill-ok'); // partial mitigation
    expect(degrade('native-ok', false, 'capability')).toBe('capability-hard'); // UA-privileged, no shim
  });

  it('absent but NOT relying on native → unaffected (already shims or already walls)', () => {
    expect(degrade('polyfill-ok', false, 'polyfillable')).toBe('polyfill-ok');
    expect(degrade('capability-hard', false, 'capability')).toBe('capability-hard');
  });

  it('only ever lowers a tier — never promotes one', () => {
    const order = { 'native-ok': 0, 'polyfill-ok': 1, 'capability-hard': 2 } as const;
    for (const arch of ['native-ok', 'polyfill-ok', 'capability-hard'] as const)
      for (const sup of [true, false, undefined])
        for (const pf of ['polyfillable', 'partial', 'capability'] as const)
          expect(order[degrade(arch, sup, pf)]).toBeGreaterThanOrEqual(order[arch]);
  });
});

describe('DegradingProvider — overrides only tier(), defers structure', () => {
  // A client lacking customizable-select natively (everything else present).
  const support: PlatformSupport = (cap) => (cap === 'customizable-select' ? false : true);
  const provider = new DegradingProvider(base, support, VOCAB);

  it('degrades a native-ok cell that lost its native feature', () => {
    expect(base.tier('base-select', 'customizable-select')).toBe('native-ok');
    expect(provider.tier('base-select', 'customizable-select')).toBe('capability-hard'); // capability class
  });

  it('leaves still-supported cells alone', () => {
    expect(provider.tier('base-select', 'popover')).toBe('native-ok');
  });

  it('defers impls / native marker / intent map / adapters to the base', () => {
    expect(provider.impls()).toEqual(base.impls());
    expect(provider.isNative('base-select')).toBe(true);
    expect(provider.requiredCapabilities('selection')).toEqual(['customizable-select', 'popover']);
    expect(provider.adapters()).toBe(base.adapters());
  });
});

describe('providerForVenue — routing', () => {
  const support: PlatformSupport = () => true;
  it('build → the base as authored', () => {
    expect(providerForVenue('build', { base, vocabulary: VOCAB })).toBe(base);
  });
  it('runtime / edge → a DegradingProvider over the support signal', () => {
    expect(providerForVenue('runtime', { base, vocabulary: VOCAB, support })).toBeInstanceOf(DegradingProvider);
    expect(providerForVenue('edge', { base, vocabulary: VOCAB, support })).toBeInstanceOf(DegradingProvider);
  });
  it('a non-build venue without a support signal is an error', () => {
    expect(() => providerForVenue('runtime', { base, vocabulary: VOCAB })).toThrow();
  });
});

describe('resolveAtVenue — same resolver, only the tiers differ', () => {
  it('build resolves the droplist slot to native base-select (full support)', () => {
    const r = resolveAtVenue('build', { base, vocabulary: VOCAB }, NATIVE_FIRST, ['selection']);
    expect(r.impl).toBe('base-select');
  });

  it('a constrained client degrades native, but the unchanged resolver still runs', () => {
    // The client lacks customizable-select → it is capability-hard on BOTH impls → no eligible impl.
    // The same #205 resolver throws NoEligibleImplError — the venue changed the tiers, not the logic.
    const support: PlatformSupport = (cap) => cap !== 'customizable-select';
    expect(() => resolveAtVenue('runtime', { base, vocabulary: VOCAB, support }, NATIVE_FIRST, ['selection'])).toThrow(
      /no impl can serve/,
    );
  });

  it('a client lacking only a polyfillable feature degrades cost but still resolves', () => {
    // popover absent → native-ok degrades to polyfill-ok on both, +1 cost, but still eligible.
    const support: PlatformSupport = (cap) => cap !== 'popover';
    const r = resolveAtVenue('runtime', { base, vocabulary: VOCAB, support }, NATIVE_FIRST, ['anchor']);
    expect(r.impl).toBe('base-select'); // still resolves — degraded, not broken
    expect(r.candidates.find((c) => c.impl === 'base-select')!.cost).toBe(1); // popover now a polyfill
  });
});
