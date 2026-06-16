/**
 * Default wiring for the capability provider — binds the shipped registries to the static
 * build-matrix impl. The data files (`src/_data/*.json`) are the single source of truth; the
 * `/capabilities/` catalog page renders the same JSON, so the page and this provider can never
 * disagree.
 */
import capabilitiesData from '../src/_data/capabilities.json';
import matrixData from '../src/_data/capabilityMatrix.json';
import intentsData from '../src/_data/intents.json';
import {
  StaticMatrixProvider,
  intentMapFromIntents,
  type Capability,
  type CapabilityAdapter,
  type CapabilityMatrix,
} from './provider.js';
import { createRuntimeProvider } from './runtime.js';
import { createEdgeProvider, EdgeChunkCache, type ClientHints } from './edge.js';
import { type PlatformSupport } from './venues.js';

export * from './provider.js';
export * from './resolver.js';
export * from './strictness.js';
export * from './cascade.js';
export * from './venues.js';
export * from './runtime.js';
export * from './edge.js';
export * from './capacity.js';
export * from './capacity-gpu.js';

export const capabilities = capabilitiesData as Capability[];

/**
 * The registered capability adapter table (#206) — `capabilityMatrix.json`'s `impls[]` rows. This
 * array *is* the source of truth: the static build-matrix grid is assembled from these rows, so the
 * catalog, the provider, and the resolver all read the same registration. Adding an impl = one row.
 */
export const capabilityAdapters = (matrixData as CapabilityMatrix).impls as CapabilityAdapter[];

/** The default `build`-venue provider, wired to the shipped vocabulary, matrix, and intent map. */
export function createDefaultProvider(): StaticMatrixProvider {
  return new StaticMatrixProvider(
    matrixData as CapabilityMatrix,
    intentMapFromIntents(intentsData as Array<{ id: string; requiresCapabilities?: string[] }>),
  );
}

/**
 * The `runtime`-venue provider wired to the shipped data (#208): the default static matrix degraded by
 * live browser feature detection. Pass a `support` map to drive it deterministically (a POC without a
 * real UA); omit it to read the actual UA.
 */
export function createDefaultRuntimeProvider(support?: PlatformSupport) {
  return support
    ? createRuntimeProvider(createDefaultProvider(), capabilities, support)
    : createRuntimeProvider(createDefaultProvider(), capabilities);
}

/** The `edge`-venue provider wired to the shipped data (#208): the matrix degraded by Client Hints. */
export function createDefaultEdgeProvider(hints: ClientHints) {
  return createEdgeProvider(createDefaultProvider(), capabilities, hints);
}

/** An edge chunk cache (#208) wired to the shipped data — chunks shared per capability-equivalence class. */
export function createDefaultEdgeCache(): EdgeChunkCache {
  return new EdgeChunkCache(createDefaultProvider(), capabilities);
}
