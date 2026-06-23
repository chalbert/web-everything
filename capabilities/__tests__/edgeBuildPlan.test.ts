/**
 * Edge venue emit-build-plan + bundler-neutrality vector (#1624, the #699(a) WE-side slice of #479).
 * Proves the edge emits a deterministic, **bundler-neutral** build plan a downstream serve-consumer
 * (plateau-app #1625) can bundle + serve, and that the WE-side conformance vector
 * (`we:capabilities/check.ts`) pins delivery-impl out of the standard repo:
 *   - `emitBuildPlan` projects an EdgeServed result onto capability-class + cache-key + URL + the
 *     declarative, web-standard negotiation/chunk header directives (reusing edge-io's own builders);
 *   - the plan is deterministic and carries NO esbuild / chunk-naming / bundler field anywhere;
 *   - `assertBuildPlanNeutral` returns [] for a real plan, and flags any injected delivery-impl creep.
 */
import { describe, it, expect } from 'vitest';
import { StaticMatrixProvider, type Capability, type CapabilityMatrix } from '../provider.js';
import { EdgeChunkCache, type ClientHints } from '../edge.js';
import { emitBuildPlan, negotiationHeaders, chunkCacheHeaders, type BuildPlan } from '../edge-io.js';
import { assertBuildPlanNeutral, BUNDLER_NEUTRAL_FORBIDDEN } from '../check.js';

const VOCAB: Capability[] = [
  { id: 'popover', label: '', webFeaturesKey: 'popover', baseline: '2024', polyfill: 'polyfillable', summary: '' },
  { id: 'anchor-positioning', label: '', webFeaturesKey: 'anchor-positioning', baseline: false, polyfill: 'polyfillable', summary: '' },
];
const MATRIX: CapabilityMatrix = {
  impls: [
    { id: 'base', label: 'base', native: true, summary: '', tiers: { popover: 'native-ok', 'anchor-positioning': 'native-ok' } },
    { id: 'face', label: 'FACE', summary: '', tiers: { popover: 'native-ok', 'anchor-positioning': 'polyfill-ok' } },
  ],
};
const base = new StaticMatrixProvider(MATRIX, { anchor: ['anchor-positioning', 'popover'] });

const NATIVE_FIRST = { policy: 'native-first' } as const;
const serveOnce = (hints: ClientHints) =>
  new EdgeChunkCache(base, VOCAB).serve({ component: 'droplist', version: 1, intentIds: ['anchor'], slot: NATIVE_FIRST, hints });

describe('emitBuildPlan — the bundler-neutral build plan (#1624)', () => {
  const served = serveOnce({ baselineYear: 2024, supports: ['anchor-positioning'] });
  const plan = emitBuildPlan(served);

  it('projects the served chunk onto capability-class + cache-key + URL', () => {
    expect(plan.capabilityClass).toBe(served.equivalenceClass);
    expect(plan.cacheKey).toBe(served.cacheKey);
    expect(plan.url).toBe(served.url);
    // the cache key carries component@version#class; the URL carries the caps query (#204/#088)
    expect(plan.cacheKey).toContain('droplist@1#');
    expect(plan.url).toContain('caps=');
  });

  it('emits ONLY declarative, web-standard header directives (reusing edge-io builders)', () => {
    expect(plan.headers.negotiation).toEqual(negotiationHeaders());
    expect(plan.headers.chunk).toEqual(chunkCacheHeaders());
    // the negotiation response varies on the Client Hints; the chunk is immutable, content-addressed
    expect(plan.headers.negotiation).toMatchObject({ Vary: expect.any(String), 'Accept-CH': expect.any(String) });
    expect(plan.headers.chunk['Cache-Control']).toContain('immutable');
  });

  it('is deterministic — same served result yields an identical plan', () => {
    expect(emitBuildPlan(served)).toEqual(plan);
  });
});

describe('assertBuildPlanNeutral — the WE-side neutrality conformance vector (#699 amendment)', () => {
  it('passes a real emit-build-plan (zero esbuild/chunk-naming/delivery fields)', () => {
    const plan = emitBuildPlan(serveOnce({ baselineYear: 2024 }));
    expect(assertBuildPlanNeutral(plan)).toEqual([]);
  });

  it('catches injected bundler/chunk-naming creep anywhere in the plan', () => {
    const dirty = {
      ...emitBuildPlan(serveOnce({ baselineYear: 2024 })),
      chunkFileNames: '[name]-[hash].js', // delivery-impl creep at the top level
    } as unknown as BuildPlan;
    const violations = assertBuildPlanNeutral(dirty);
    expect(violations.some((v) => v.includes('chunkFileNames'))).toBe(true);
    expect(violations.some((v) => v.includes('chunkfile'))).toBe(true);
  });

  it('catches a non-standard header directive that smuggles in an esbuild option', () => {
    const plan = emitBuildPlan(serveOnce({ baselineYear: 2024 }));
    (plan.headers.chunk as Record<string, string>).esbuildTarget = 'es2022';
    const violations = assertBuildPlanNeutral(plan);
    expect(violations.some((v) => v.includes('unexpected directive'))).toBe(true);
    expect(violations.some((v) => v.includes('esbuild'))).toBe(true);
  });

  it('the forbidden list omits bare "chunk" so a legitimate response group is not flagged', () => {
    expect((BUNDLER_NEUTRAL_FORBIDDEN as readonly string[]).includes('chunk')).toBe(false);
    expect(assertBuildPlanNeutral(emitBuildPlan(serveOnce({ baselineYear: 2024 })))).toEqual([]);
  });
});
