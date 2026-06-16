/**
 * Capacity provider (#767, building #729 Fork 1 + 2) — the device-resource sibling of the capability
 * provider. Asserts: every read answers BOTH a scalar and a derived bucket; the native impl reads
 * `navigator` SSR-safely; the Venue dimension routes which source resolves; the `undefined`-degrade
 * contract holds for signals a venue can't read (cores/GPU at the edge, everything at build).
 */
import { describe, it, expect } from 'vitest';
import {
  CAPACITY_DIMENSIONS,
  deriveBucket,
  SourceCapacityProvider,
  NATIVE_CAPACITY_ADAPTER,
  EDGE_CAPACITY_ADAPTER,
  nativeCapacitySource,
  edgeCapacitySource,
  createNativeCapacityProvider,
  createEdgeCapacityProvider,
  capacityProviderForVenue,
  UnknownCapacityDimensionError,
  type CapacityDimensionId,
} from '../capacity.js';

function fakeNavigator(overrides: Record<string, unknown> = {}): Navigator {
  return overrides as unknown as Navigator;
}

describe('deriveBucket — scalar→bucket policy (#729 Fork 2)', () => {
  it('buckets count dimensions on the adaptive-loading thresholds', () => {
    expect(deriveBucket('hardwareConcurrency', 8)).toBe('high');
    expect(deriveBucket('hardwareConcurrency', 4)).toBe('mid');
    expect(deriveBucket('hardwareConcurrency', 2)).toBe('low');
    expect(deriveBucket('deviceMemory', 8)).toBe('high');
    expect(deriveBucket('deviceMemory', 4)).toBe('mid');
    expect(deriveBucket('deviceMemory', 0.5)).toBe('low');
  });

  it('buckets effective connection type by class', () => {
    expect(deriveBucket('effectiveType', '4g')).toBe('high');
    expect(deriveBucket('effectiveType', '3g')).toBe('mid');
    expect(deriveBucket('effectiveType', '2g')).toBe('low');
    expect(deriveBucket('effectiveType', 'slow-2g')).toBe('low');
    expect(deriveBucket('effectiveType', 'nonsense')).toBeUndefined();
  });

  it('treats data-saver as a low-headroom signal', () => {
    expect(deriveBucket('saveData', true)).toBe('low');
    expect(deriveBucket('saveData', false)).toBe('high');
  });

  it('returns undefined for an unknown scalar (degrade contract)', () => {
    expect(deriveBucket('deviceMemory', undefined)).toBeUndefined();
    expect(deriveBucket('hardwareConcurrency', undefined)).toBeUndefined();
  });
});

describe('SourceCapacityProvider — every read is scalar + bucket', () => {
  it('answers both shapes from a source', () => {
    const provider = new SourceCapacityProvider([NATIVE_CAPACITY_ADAPTER], (d) =>
      d === 'deviceMemory' ? 8 : undefined,
    );
    expect(provider.read('deviceMemory')).toEqual({ dimension: 'deviceMemory', scalar: 8, bucket: 'high' });
    expect(provider.read('hardwareConcurrency')).toEqual({
      dimension: 'hardwareConcurrency',
      scalar: undefined,
      bucket: undefined,
    });
  });

  it('readAll covers the whole vocabulary', () => {
    const provider = new SourceCapacityProvider([NATIVE_CAPACITY_ADAPTER], () => undefined);
    expect(provider.readAll().map((r) => r.dimension)).toEqual(CAPACITY_DIMENSIONS.map((d) => d.id));
  });

  it('throws on a dimension outside the vocabulary', () => {
    const provider = new SourceCapacityProvider([], () => undefined);
    expect(() => provider.read('madeUp' as CapacityDimensionId)).toThrow(UnknownCapacityDimensionError);
  });

  it('exposes the registered adapter table + native marker (#206)', () => {
    const provider = createNativeCapacityProvider(fakeNavigator());
    expect(provider.adapters()).toEqual([NATIVE_CAPACITY_ADAPTER]);
    expect(provider.isNative('native')).toBe(true);
    expect(provider.isNative('edge')).toBe(false);
  });
});

describe('nativeCapacitySource — reads navigator, SSR-safe', () => {
  it('reads cores / memory / connection live', () => {
    const src = nativeCapacitySource(
      fakeNavigator({ hardwareConcurrency: 8, deviceMemory: 8, connection: { effectiveType: '4g', saveData: false } }),
    );
    expect(src('hardwareConcurrency')).toBe(8);
    expect(src('deviceMemory')).toBe(8);
    expect(src('effectiveType')).toBe('4g');
    expect(src('saveData')).toBe(false);
  });

  it('reports gpuTier unknown (probe is the #729 spin-off)', () => {
    const src = nativeCapacitySource(fakeNavigator({ hardwareConcurrency: 8 }));
    expect(src('gpuTier')).toBeUndefined();
  });

  it('reads undefined when navigator is absent (SSR) or a signal is missing', () => {
    expect(nativeCapacitySource(undefined)('deviceMemory')).toBeUndefined();
    expect(nativeCapacitySource(fakeNavigator({}))('hardwareConcurrency')).toBeUndefined();
  });
});

describe('capacityProviderForVenue — the Venue dimension routes the source (#729 Fork 1)', () => {
  it('runtime reads navigator', () => {
    const provider = capacityProviderForVenue('runtime', {
      navigator: fakeNavigator({ deviceMemory: 4 }),
    });
    expect(provider.read('deviceMemory')).toEqual({ dimension: 'deviceMemory', scalar: 4, bucket: 'mid' });
  });

  it('edge reads Client Hints; runtime-only signals degrade to unknown', () => {
    const provider = capacityProviderForVenue('edge', { hints: { deviceMemory: 8, effectiveType: '3g', saveData: true } });
    expect(provider.read('deviceMemory')).toEqual({ dimension: 'deviceMemory', scalar: 8, bucket: 'high' });
    expect(provider.read('effectiveType').bucket).toBe('mid');
    expect(provider.read('saveData').bucket).toBe('low');
    // hardwareConcurrency / gpuTier carry no header — unknown at the edge.
    expect(provider.read('hardwareConcurrency')).toEqual({
      dimension: 'hardwareConcurrency',
      scalar: undefined,
      bucket: undefined,
    });
    expect(provider.read('gpuTier').bucket).toBeUndefined();
  });

  it('build has no live device — every read is unknown', () => {
    const provider = capacityProviderForVenue('build');
    expect(provider.readAll().every((r) => r.scalar === undefined && r.bucket === undefined)).toBe(true);
  });

  it('edge source helper aligns with the edge adapter row', () => {
    expect(createEdgeCapacityProvider({}).adapters()).toEqual([EDGE_CAPACITY_ADAPTER]);
    expect(edgeCapacitySource({ deviceMemory: 2 })('deviceMemory')).toBe(2);
    expect(edgeCapacitySource({ deviceMemory: 2 })('hardwareConcurrency')).toBeUndefined();
  });
});
