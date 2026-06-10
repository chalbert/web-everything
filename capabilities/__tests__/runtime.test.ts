/**
 * Runtime feature-detection venue (#208) — DoD: tier a droplist against the live UA, degrade
 * gracefully on a wrong guess, and fall back to the static matrix where a capability isn't detectable.
 *   - `browserFeatureSupport` reads injected detectors (deterministic, no real UA needed);
 *   - undetectable capabilities (`cross-root-aria`, no detector) → `undefined` → the static tier stands;
 *   - the real `BROWSER_DETECTORS` never throw outside a browser — they return `undefined`.
 */
import { describe, it, expect } from 'vitest';
import { StaticMatrixProvider, type Capability, type CapabilityMatrix } from '../provider.js';
import { resolveSlot } from '../resolver.js';
import { BROWSER_DETECTORS, browserFeatureSupport, createRuntimeProvider } from '../runtime.js';

const NATIVE_FIRST = { policy: 'native-first' } as const;

const VOCAB: Capability[] = [
  { id: 'popover', label: '', webFeaturesKey: 'popover', baseline: '2024', polyfill: 'polyfillable', summary: '' },
  { id: 'anchor-positioning', label: '', webFeaturesKey: 'anchor-positioning', baseline: false, polyfill: 'polyfillable', summary: '' },
  { id: 'cross-root-aria', label: '', webFeaturesKey: 'cross-root-aria', baseline: false, polyfill: 'partial', summary: '' },
];

const MATRIX: CapabilityMatrix = {
  impls: [
    {
      id: 'base-select',
      label: 'base-select',
      native: true,
      summary: '',
      tiers: { popover: 'native-ok', 'anchor-positioning': 'native-ok', 'cross-root-aria': 'native-ok' },
    },
    {
      id: 'face',
      label: 'FACE',
      summary: '',
      tiers: { popover: 'native-ok', 'anchor-positioning': 'polyfill-ok', 'cross-root-aria': 'capability-hard' },
    },
  ],
};
const INTENT_MAP = { anchor: ['anchor-positioning', 'popover'], combobox: ['cross-root-aria', 'popover'] };
const base = new StaticMatrixProvider(MATRIX, INTENT_MAP);

describe('browserFeatureSupport — injected detectors drive the signal', () => {
  it('reads true/false/undefined from the supplied detector map', () => {
    const support = browserFeatureSupport({
      popover: () => true,
      'anchor-positioning': () => false,
      // no entry for cross-root-aria → undefined
    });
    expect(support('popover')).toBe(true);
    expect(support('anchor-positioning')).toBe(false);
    expect(support('cross-root-aria')).toBeUndefined();
  });
});

describe('createRuntimeProvider — degrade the matrix by detected support', () => {
  it('an absent polyfillable feature degrades native-ok → polyfill-ok', () => {
    const support = browserFeatureSupport({ 'anchor-positioning': () => false, popover: () => true });
    const provider = createRuntimeProvider(base, VOCAB, support);
    expect(base.tier('base-select', 'anchor-positioning')).toBe('native-ok');
    expect(provider.tier('base-select', 'anchor-positioning')).toBe('polyfill-ok'); // degraded, recoverable
  });

  it('an undetectable capability falls back to the static matrix tier', () => {
    // No detector for cross-root-aria → undefined → both impls keep their authored tier.
    const support = browserFeatureSupport({ popover: () => true });
    const provider = createRuntimeProvider(base, VOCAB, support);
    expect(provider.tier('base-select', 'cross-root-aria')).toBe('native-ok'); // matrix value, unchanged
    expect(provider.tier('face', 'cross-root-aria')).toBe('capability-hard');
  });
});

describe('DoD — resolve a droplist against the (modelled) live UA, degrade not break', () => {
  it('full support: native-first resolves the slot to native base-select at cost 0', () => {
    const support = browserFeatureSupport({ popover: () => true, 'anchor-positioning': () => true });
    const provider = createRuntimeProvider(base, VOCAB, support);
    const r = resolveSlot(provider, NATIVE_FIRST, ['anchor']);
    expect(r.impl).toBe('base-select');
    expect(r.candidates.find((c) => c.impl === 'base-select')!.cost).toBe(0);
  });

  it('a UA missing anchor-positioning: base-select still wins but its resolution DEGRADES (cost ↑)', () => {
    const support = browserFeatureSupport({ popover: () => true, 'anchor-positioning': () => false });
    const provider = createRuntimeProvider(base, VOCAB, support);
    const r = resolveSlot(provider, NATIVE_FIRST, ['anchor']);
    expect(r.impl).toBe('base-select'); // a wrong/absent feature degrades, it does not break
    expect(r.candidates.find((c) => c.impl === 'base-select')!.cost).toBe(1); // anchor-positioning now polyfilled
  });
});

describe('the real browser detectors run safely against the live environment', () => {
  it('every detector returns a boolean or undefined — never throws', () => {
    for (const [id, detect] of Object.entries(BROWSER_DETECTORS)) {
      expect(() => detect(), `detector ${id} threw`).not.toThrow();
      const v = detect();
      expect(['boolean', 'undefined'], `detector ${id} returned ${typeof v}`).toContain(typeof v);
    }
  });

  it('a capability with no detector is undetectable → undefined (falls back to the matrix)', () => {
    // cross-root-aria is deliberately absent from BROWSER_DETECTORS (the a11y-tree gap JS cannot probe).
    expect(browserFeatureSupport()('cross-root-aria')).toBeUndefined();
    expect(browserFeatureSupport()('not-a-real-capability')).toBeUndefined();
  });
});
