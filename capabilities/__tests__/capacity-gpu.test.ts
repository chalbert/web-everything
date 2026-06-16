/**
 * GPU-tier capacity source (#769, the #729 GPU-tier spin-off). Asserts: the async detect-gpu probe is
 * cached into a synchronous source; the source reports `undefined` until ready (degrade contract) and a
 * failed probe stays unknown; the raw tier 0–3 is the scalar and {@link deriveBucket} maps it to a
 * bucket; the adapter row answers only `gpuTier`. A fake probe is injected so no real WebGL runs.
 */
import { describe, it, expect } from 'vitest';
import { deriveBucket } from '../capacity.js';
import {
  GPU_CAPACITY_ADAPTER,
  createGpuCapacitySource,
  createGpuCapacityProvider,
  type GpuTierProbe,
} from '../capacity-gpu.js';

const probeOf = (tier: number): GpuTierProbe => async () => ({ tier });

describe('deriveBucket — gpuTier maps detect-gpu raw tier 0–3 (#769)', () => {
  it('maps tier 3 → high, 2 → mid, 1 and 0 → low', () => {
    expect(deriveBucket('gpuTier', 3)).toBe('high');
    expect(deriveBucket('gpuTier', 2)).toBe('mid');
    expect(deriveBucket('gpuTier', 1)).toBe('low');
    expect(deriveBucket('gpuTier', 0)).toBe('low'); // no WebGL / blocklisted → low headroom
  });

  it('still accepts a pre-bucketed string verbatim (back-compat)', () => {
    expect(deriveBucket('gpuTier', 'high')).toBe('high');
    expect(deriveBucket('gpuTier', 'nonsense')).toBeUndefined();
  });

  it('reports unknown for a non-finite scalar', () => {
    expect(deriveBucket('gpuTier', undefined)).toBeUndefined();
    expect(deriveBucket('gpuTier', Number.NaN)).toBeUndefined();
  });
});

describe('createGpuCapacitySource — async-over-sync caching', () => {
  it('reports undefined before the probe resolves, then the cached tier', async () => {
    const { source, ready } = createGpuCapacitySource(probeOf(3));
    expect(source('gpuTier')).toBeUndefined(); // not yet resolved
    await ready;
    expect(source('gpuTier')).toBe(3);
    expect(deriveBucket('gpuTier', source('gpuTier'))).toBe('high');
  });

  it('answers only the gpuTier dimension', async () => {
    const { source, ready } = createGpuCapacitySource(probeOf(2));
    await ready;
    expect(source('gpuTier')).toBe(2);
    expect(source('deviceMemory')).toBeUndefined();
    expect(source('hardwareConcurrency')).toBeUndefined();
  });

  it('stays unknown when the probe rejects (degrade contract)', async () => {
    const failing: GpuTierProbe = async () => {
      throw new Error('no WebGL');
    };
    const { source, ready } = createGpuCapacitySource(failing);
    await ready; // resolves (the rejection is swallowed)
    expect(source('gpuTier')).toBeUndefined();
  });
});

describe('createGpuCapacityProvider — registered impl shape', () => {
  it('exposes the gpu adapter row resolving only gpuTier, non-native', async () => {
    const { provider, ready } = createGpuCapacityProvider(probeOf(3));
    await ready;
    expect(provider.adapters()).toEqual([GPU_CAPACITY_ADAPTER]);
    expect(GPU_CAPACITY_ADAPTER.dimensions).toEqual(['gpuTier']);
    expect(provider.isNative('gpu')).toBe(false);
    const reading = provider.read('gpuTier');
    expect(reading).toEqual({ dimension: 'gpuTier', scalar: 3, bucket: 'high' });
  });
});
