/**
 * Composite provider — by-domain routing (#768, #729 Fork 3-A). Asserts: each dimension routes to its
 * domain's source (compute → native, gpu → #769, network → edge); an unconfigured domain reads unknown
 * (degrade, no throw); the adapter union dedupes; isNative is the OR across slots; the generic router
 * collapses to single-provider behaviour when one provider is registered for every domain. Fakes inject
 * navigator / hints / GPU probe so no real WebGL or browser globals are touched.
 */
import { describe, it, expect } from 'vitest';
import {
  createNativeCapacityProvider,
  type CapacityDimensionId,
} from '../capacity.js';
import {
  ByDomainRouter,
  CAPACITY_DIMENSION_DOMAIN,
  CompositeCapacityProvider,
  createCompositeCapacityProvider,
} from '../composite.js';

function fakeNavigator(overrides: Record<string, unknown> = {}): Navigator {
  return overrides as unknown as Navigator;
}

describe('ByDomainRouter — generic by-domain dispatch (#729 Fork 3-A)', () => {
  it('routes each domain to its provider and lists configured domains', () => {
    const r = new ByDomainRouter<'a' | 'b', string>({ a: 'pa', b: 'pb' });
    expect(r.route('a')).toBe('pa');
    expect(r.route('b')).toBe('pb');
    expect(r.domains().sort()).toEqual(['a', 'b']);
  });

  it('returns undefined for an unconfigured domain', () => {
    const r = new ByDomainRouter<'a' | 'b', string>({ a: 'pa' });
    expect(r.route('b')).toBeUndefined();
  });

  it('collapses to single-provider behaviour when one provider fills every domain', () => {
    const one = 'only';
    const r = new ByDomainRouter<'a' | 'b' | 'c', string>({ a: one, b: one, c: one });
    expect(r.providers()).toEqual(['only']); // deduped to the single instance
    expect(r.route('a')).toBe(r.route('c'));
  });
});

describe('CompositeCapacityProvider — per-domain routing into one CapacityProvider', () => {
  const probe3 = async () => ({ tier: 3 });

  it('routes compute → native, gpu → #769, network → edge', async () => {
    const { provider, ready } = createCompositeCapacityProvider({
      navigator: fakeNavigator({ hardwareConcurrency: 8, deviceMemory: 8 }),
      hints: { effectiveType: '4g', saveData: false },
      gpuProbe: probe3,
    });
    await ready;
    expect(provider.read('hardwareConcurrency')).toEqual({ dimension: 'hardwareConcurrency', scalar: 8, bucket: 'high' });
    expect(provider.read('gpuTier')).toEqual({ dimension: 'gpuTier', scalar: 3, bucket: 'high' });
    expect(provider.read('effectiveType')).toEqual({ dimension: 'effectiveType', scalar: '4g', bucket: 'high' });
    expect(provider.read('saveData')).toEqual({ dimension: 'saveData', scalar: false, bucket: 'high' });
  });

  it('maps every dimension to a coarse domain (not per-id)', () => {
    const domains = new Set(Object.values(CAPACITY_DIMENSION_DOMAIN));
    expect(domains).toEqual(new Set(['compute', 'gpu', 'network']));
    expect(CAPACITY_DIMENSION_DOMAIN.gpuTier).toBe('gpu');
    expect(CAPACITY_DIMENSION_DOMAIN.effectiveType).toBe('network');
  });

  it('reads unknown (no throw) for a dimension whose domain has no provider', () => {
    const provider = new CompositeCapacityProvider({
      compute: createNativeCapacityProvider(fakeNavigator({ deviceMemory: 4 })),
      // gpu + network deliberately unconfigured
    });
    expect(provider.read('deviceMemory')).toEqual({ dimension: 'deviceMemory', scalar: 4, bucket: 'mid' });
    expect(provider.read('gpuTier')).toEqual({ dimension: 'gpuTier', scalar: undefined, bucket: undefined });
    expect(provider.read('effectiveType')).toEqual({ dimension: 'effectiveType', scalar: undefined, bucket: undefined });
  });

  it('readAll covers the whole vocabulary; adapters() unions+dedupes; isNative ORs the slots', async () => {
    const { provider, ready } = createCompositeCapacityProvider({
      navigator: fakeNavigator({ hardwareConcurrency: 2 }),
      gpuProbe: probe3,
    });
    await ready;
    expect(provider.readAll().map((r) => r.dimension)).toEqual(provider.dimensions());
    const ids = provider.adapters().map((a) => a.id).sort();
    expect(ids).toEqual(['edge', 'gpu', 'native']);
    expect(provider.isNative('native')).toBe(true); // native compute source marks itself native
    expect(provider.isNative('gpu')).toBe(false);
  });
});
