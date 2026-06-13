/**
 * Incremental / delta module updates (#103). Proves the patch-vs-full decision and the orchestration
 * invariant: a patch is tried on demand, the result is integrity-verified against `toHash`, and any
 * unavailability or mismatch falls back to a verified full download — a corrupt patch never installs.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  chooseDeliveryShape,
  applyIncrementalUpdate,
  sha256OfBytes,
  IntegrityError,
} from '../../../renderers/module-service/incrementalUpdate';

const bytes = (s: string) => new TextEncoder().encode(s);

describe('chooseDeliveryShape (#103)', () => {
  it('patches when the patch is below half the full size', () => {
    expect(chooseDeliveryShape({ fullSize: 1000, patchSize: 100 })).toBe('patch');
  });
  it('ships full when the patch is not worth it (>= threshold)', () => {
    expect(chooseDeliveryShape({ fullSize: 1000, patchSize: 600 })).toBe('full');
  });
  it('honours a custom threshold', () => {
    expect(chooseDeliveryShape({ fullSize: 1000, patchSize: 250, threshold: 0.2 })).toBe('full');
    expect(chooseDeliveryShape({ fullSize: 1000, patchSize: 150, threshold: 0.2 })).toBe('patch');
  });
  it('never patches blind when the full size is unknown', () => {
    expect(chooseDeliveryShape({ fullSize: 0, patchSize: 1 })).toBe('full');
  });
});

describe('sha256OfBytes (#088 identity format)', () => {
  it('produces a sha256-<base64> hash', async () => {
    expect(await sha256OfBytes(bytes('hello'))).toMatch(/^sha256-[A-Za-z0-9+/]+=*$/);
  });
});

describe('applyIncrementalUpdate (#103)', () => {
  it('applies a patch on demand and returns the verified result (shape: patch)', async () => {
    const next = bytes('v2-module-contents');
    const toHash = await sha256OfBytes(next);
    const applyPatch = vi.fn(() => next); // injected diff yields the correct bytes
    const resolveFull = vi.fn(async () => next);
    const r = await applyIncrementalUpdate({
      fromHash: 'sha256-prev',
      toHash,
      previous: bytes('v1-module-contents'),
      resolvePatch: async () => bytes('delta'),
      resolveFull,
      applyPatch,
    });
    expect(r).toMatchObject({ shape: 'patch', fellBackToFull: false });
    expect(r.bytes).toEqual(next);
    expect(resolveFull).not.toHaveBeenCalled(); // patch succeeded → no full download
  });

  it('falls back to a full download when the patched result fails integrity', async () => {
    const next = bytes('the-real-v2');
    const toHash = await sha256OfBytes(next);
    const resolveFull = vi.fn(async () => next);
    const r = await applyIncrementalUpdate({
      fromHash: 'sha256-prev',
      toHash,
      previous: bytes('v1'),
      resolvePatch: async () => bytes('corrupt-delta'),
      applyPatch: () => bytes('WRONG-patched-output'), // hashes != toHash → discarded
      resolveFull,
    });
    expect(r).toMatchObject({ shape: 'full', fellBackToFull: true });
    expect(r.bytes).toEqual(next);
    expect(resolveFull).toHaveBeenCalledOnce();
  });

  it('downloads full (no fallback flag) when there is no cached previous', async () => {
    const next = bytes('fresh-install');
    const toHash = await sha256OfBytes(next);
    const applyPatch = vi.fn();
    const r = await applyIncrementalUpdate({
      fromHash: null,
      toHash,
      previous: null,
      resolvePatch: async () => bytes('unused'),
      applyPatch,
      resolveFull: async () => next,
    });
    expect(r).toMatchObject({ shape: 'full', fellBackToFull: false });
    expect(applyPatch).not.toHaveBeenCalled();
  });

  it('downloads full when no patch is available for the pair (resolvePatch → null)', async () => {
    const next = bytes('v2');
    const toHash = await sha256OfBytes(next);
    const r = await applyIncrementalUpdate({
      fromHash: 'sha256-prev',
      toHash,
      previous: bytes('v1'),
      resolvePatch: async () => null,
      applyPatch: () => bytes('unused'),
      resolveFull: async () => next,
    });
    expect(r).toMatchObject({ shape: 'full', fellBackToFull: false });
  });

  it('throws IntegrityError when even the full download fails its hash', async () => {
    await expect(
      applyIncrementalUpdate({
        fromHash: null,
        toHash: 'sha256-something-else',
        previous: null,
        resolvePatch: async () => null,
        applyPatch: () => bytes('x'),
        resolveFull: async () => bytes('corrupt-from-origin'),
      }),
    ).rejects.toBeInstanceOf(IntegrityError);
  });
});
