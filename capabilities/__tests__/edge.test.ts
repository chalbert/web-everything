/**
 * Edge module-as-a-service venue (#208) — DoD: serve a capability-keyed chunk cached per
 * equivalence class with a Client-Hints signal, degrade gracefully on a wrong guess.
 *   - `clientHintsSupport` reads a declared profile server-side (baseline year + overrides), never a UA;
 *   - `equivalenceClass` keys on the supported subset of requested caps — two UAs in one class share a chunk;
 *   - `componentUrl` carries the URL-serializable cap ids (#204);
 *   - a wrong support guess degrades the resolution (progressive enhancement), it does not break.
 */
import { describe, it, expect } from 'vitest';
import { StaticMatrixProvider, type Capability, type CapabilityMatrix } from '../provider.js';
import { validateSlot } from '../strictness.js';
import {
  clientHintsSupport,
  equivalenceClass,
  componentUrl,
  EdgeChunkCache,
  createEdgeProvider,
  type ClientHints,
} from '../edge.js';

const NATIVE_FIRST = { policy: 'native-first' } as const;

const VOCAB: Capability[] = [
  { id: 'popover', label: '', webFeaturesKey: 'popover', baseline: '2024', polyfill: 'polyfillable', summary: '' },
  { id: 'dialog', label: '', webFeaturesKey: 'dialog', baseline: '2022', polyfill: 'polyfillable', summary: '' },
  { id: 'anchor-positioning', label: '', webFeaturesKey: 'anchor-positioning', baseline: false, polyfill: 'polyfillable', summary: '' },
  { id: 'customizable-select', label: '', webFeaturesKey: 'customizable-select', baseline: false, polyfill: 'capability', summary: '' },
];

const MATRIX: CapabilityMatrix = {
  impls: [
    {
      id: 'base-select',
      label: 'base-select',
      native: true,
      summary: '',
      tiers: { popover: 'native-ok', dialog: 'native-ok', 'anchor-positioning': 'native-ok', 'customizable-select': 'native-ok' },
    },
    {
      id: 'face',
      label: 'FACE',
      summary: '',
      tiers: { popover: 'native-ok', dialog: 'native-ok', 'anchor-positioning': 'polyfill-ok', 'customizable-select': 'capability-hard' },
    },
  ],
};
const INTENT_MAP = { anchor: ['anchor-positioning', 'popover'], selection: ['customizable-select', 'popover'] };
const base = new StaticMatrixProvider(MATRIX, INTENT_MAP);

describe('clientHintsSupport — server-side, declared profile (not UA sniffing)', () => {
  it('a baseline year supports every capability at or below it', () => {
    const support = clientHintsSupport({ baselineYear: 2024 }, VOCAB);
    expect(support('dialog')).toBe(true); // 2022 ≤ 2024
    expect(support('popover')).toBe(true); // 2024 ≤ 2024
    expect(support('anchor-positioning')).toBe(false); // not-yet-Baseline, un-hinted → absent
  });

  it('explicit supports/lacks override the year heuristic', () => {
    const support = clientHintsSupport(
      { baselineYear: 2024, supports: ['anchor-positioning'], lacks: ['popover'] },
      VOCAB,
    );
    expect(support('anchor-positioning')).toBe(true); // forced on
    expect(support('popover')).toBe(false); // forced off
  });

  it('is total — always boolean, never undefined (the edge commits to a guess)', () => {
    const support = clientHintsSupport({ baselineYear: 2020 }, VOCAB);
    for (const cap of VOCAB) expect(typeof support(cap.id)).toBe('boolean');
  });
});

describe('componentUrl — caps ride in the URL (#204 URL-serializable ids)', () => {
  it('puts the component@version in the path and the sorted caps in the query', () => {
    expect(componentUrl('droplist', 1, ['popover', 'anchor-positioning'])).toBe(
      '/c/droplist@1?caps=anchor-positioning%2Cpopover',
    );
  });
});

describe('equivalenceClass — key on the supported subset, not the raw UA', () => {
  it('two different hints with the same supported subset collapse to one class', () => {
    const caps = ['anchor-positioning', 'popover'];
    // A modern Chrome and a modern Firefox: different UAs, same support of these caps.
    const a = clientHintsSupport({ baselineYear: 2024, supports: ['anchor-positioning'] }, VOCAB);
    const b = clientHintsSupport({ baselineYear: 2025, supports: ['anchor-positioning'] }, VOCAB);
    expect(equivalenceClass(caps, a)).toBe(equivalenceClass(caps, b));
  });

  it('a client lacking a cap lands in a different class', () => {
    const caps = ['anchor-positioning', 'popover'];
    const modern = clientHintsSupport({ baselineYear: 2024, supports: ['anchor-positioning'] }, VOCAB);
    const old = clientHintsSupport({ baselineYear: 2024 }, VOCAB); // no anchor-positioning
    expect(equivalenceClass(caps, modern)).not.toBe(equivalenceClass(caps, old));
    expect(equivalenceClass(caps, old)).toBe('anchor-positioning-,popover+');
  });
});

describe('EdgeChunkCache — one chunk per equivalence class, shared across UAs', () => {
  it('two distinct hints in the same class share one built chunk (cache hit)', () => {
    const cache = new EdgeChunkCache(base, VOCAB);
    const chrome: ClientHints = { baselineYear: 2024, supports: ['anchor-positioning'] };
    const firefox: ClientHints = { baselineYear: 2025, supports: ['anchor-positioning'] }; // same support, different UA
    const req = (hints: ClientHints) => ({ component: 'droplist', version: 1, intentIds: ['anchor'], slot: NATIVE_FIRST, hints });

    const first = cache.serve(req(chrome));
    const second = cache.serve(req(firefox));

    expect(first.fromCache).toBe(false);
    expect(second.fromCache).toBe(true); // shared — keyed on capabilities, not UA
    expect(second.cacheKey).toBe(first.cacheKey);
    expect(second.chunk).toBe(first.chunk); // literally the same chunk object
    expect(cache.size).toBe(1);
    expect(first.url).toBe('/c/droplist@1?caps=anchor-positioning%2Cpopover');
    expect(first.chunk.resolution.impl).toBe('base-select');
  });

  it('a client in a different class gets its own chunk', () => {
    const cache = new EdgeChunkCache(base, VOCAB);
    const req = (hints: ClientHints) => ({ component: 'droplist', version: 1, intentIds: ['anchor'], slot: NATIVE_FIRST, hints });
    cache.serve(req({ baselineYear: 2024, supports: ['anchor-positioning'] })); // anchor-positioning+
    const degraded = cache.serve(req({ baselineYear: 2024 })); // anchor-positioning-
    expect(degraded.fromCache).toBe(false);
    expect(cache.size).toBe(2);
    // degraded but not broken: base-select still resolves, anchor-positioning now polyfilled (+1 cost).
    expect(degraded.chunk.resolution.impl).toBe('base-select');
    expect(degraded.chunk.resolution.candidates.find((c) => c.impl === 'base-select')!.cost).toBe(1);
  });
});

describe('progressive enhancement — a wrong support guess degrades, not breaks', () => {
  it('the server guessed a feature present that the client actually lacks → resolution degrades at warn', () => {
    // Server serves a chunk under an optimistic guess; the real client lacks anchor-positioning.
    const actual = createEdgeProvider(base, VOCAB, { baselineYear: 2024 }); // no anchor-positioning
    const outcome = validateSlot(actual, NATIVE_FIRST, ['anchor'], 'warn');
    expect(outcome.valid).toBe(true); // still resolves
    expect(outcome.resolution?.impl).toBe('base-select'); // degraded onto a heavier path, not dropped
  });

  it('a required UA-privileged feature truly absent surfaces as a problem (reported, severity = the knob)', () => {
    // customizable-select (capability class) absent → capability-hard on both impls → unresolvable policy.
    const actual = createEdgeProvider(base, VOCAB, { baselineYear: 2024 }); // customizable-select not Baseline → absent
    const outcome = validateSlot(actual, NATIVE_FIRST, ['selection'], 'warn');
    expect(outcome.valid).toBe(false);
    expect(outcome.problem?.kind).toBe('policy-unresolvable');
    expect(outcome.severity).toBe('warn'); // PE: reported, not thrown — a wrong guess degrades
  });
});
