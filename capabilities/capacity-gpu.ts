/**
 * GPU-tier capacity source (#769, building the ratified #729 GPU-tier spin-off) — the one delegated
 * dependency the #729 survey found warranting a third-party lib (CPU / RAM / network are native
 * `navigator` reads; battery was excluded as broken). Delegates to `detect-gpu` (pmndrs), which probes
 * the WebGL/WebGPU adapter against a benchmark dataset and returns a coarse `tier` 0–3.
 *
 * Registers as a **capacity resolver impl** (impl-is-not-a-standard): it answers only the `gpuTier`
 * dimension of the #767 {@link CapacityProvider} contract, reporting the raw scalar tier; the coarse
 * bucket is derived centrally by {@link deriveBucket} like every other dimension (#729 Fork 2).
 *
 * **Async-over-sync.** `detect-gpu`'s `getGPUTier()` is asynchronous (it loads a benchmark JSON and may
 * render a probe frame), but a {@link CapacitySource} is synchronous. So the probe runs **once** at
 * construction and caches its tier; the synchronous source returns the cached scalar, or `undefined`
 * (unknown) until the probe resolves — exactly the `undefined`-means-unknown degrade contract every
 * other source already honours. Await {@link GpuCapacitySource.ready} when a consumer needs the
 * resolved value (tests inject a fake probe instead of running real WebGL).
 */
import type { CapacityAdapter, CapacityDimensionId, CapacityScalar } from './capacity.js';
import { SourceCapacityProvider } from './capacity.js';

/** The async GPU probe — the subset of `detect-gpu`'s `getGPUTier` result this source consumes. */
export type GpuTierProbe = () => Promise<{ tier: number }>;

/** The registered GPU capacity adapter row (#206) — a delegated (non-native) source for `gpuTier` only. */
export const GPU_CAPACITY_ADAPTER: CapacityAdapter = {
  id: 'gpu',
  label: 'GPU tier (detect-gpu)',
  summary:
    'Delegated source probing the WebGL/WebGPU adapter via detect-gpu (pmndrs) for a coarse GPU tier ' +
    '(0–3), to gate expensive visual effects. The one #729-sanctioned dependency; runtime-only, async ' +
    'probe cached at construction. Reports unknown until the probe resolves.',
  dimensions: ['gpuTier'],
};

/** The default probe — lazily imports `detect-gpu` so the dep never loads in SSR/build venues. */
export const defaultGpuTierProbe: GpuTierProbe = async () => {
  const { getGPUTier } = await import('detect-gpu');
  return getGPUTier();
};

/** A synchronous capacity source backed by a cached, asynchronously-probed GPU tier. */
export interface GpuCapacitySource {
  /** The sync source: returns the cached tier for `gpuTier`, `undefined` for anything else / not-yet-ready. */
  source: (dimension: CapacityDimensionId) => CapacityScalar;
  /** Resolves once the async probe has filled the cache (or failed, leaving the source at `undefined`). */
  ready: Promise<void>;
}

/**
 * Build a GPU capacity source. Kicks off `probe()` immediately; the returned `source` reads the cached
 * tier (`undefined` until resolved, and on probe failure). Inject `probe` in tests to avoid real WebGL.
 */
export function createGpuCapacitySource(probe: GpuTierProbe = defaultGpuTierProbe): GpuCapacitySource {
  let cachedTier: number | undefined;
  const ready = probe()
    .then(({ tier }) => {
      if (typeof tier === 'number' && Number.isFinite(tier)) cachedTier = tier;
    })
    .catch(() => {
      // Probe failed (no WebGL, benchmark fetch error) — stay unknown, per the degrade contract.
    });
  const source = (dimension: CapacityDimensionId): CapacityScalar =>
    dimension === 'gpuTier' ? cachedTier : undefined;
  return { source, ready };
}

/**
 * Wire a GPU-only capacity provider over the {@link GPU_CAPACITY_ADAPTER}. Returns the provider plus the
 * probe's `ready` promise. Normally composed with the native provider via the #768 by-domain router
 * rather than used alone — but standalone it answers `gpuTier` and reports every other dimension unknown.
 */
export function createGpuCapacityProvider(
  probe: GpuTierProbe = defaultGpuTierProbe,
): { provider: SourceCapacityProvider; ready: Promise<void> } {
  const { source, ready } = createGpuCapacitySource(probe);
  return { provider: new SourceCapacityProvider([GPU_CAPACITY_ADAPTER], source), ready };
}
