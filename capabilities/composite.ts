/**
 * Composite provider — by-domain routing (#768, building the ratified #729 Fork 3-A).
 *
 * `providerForVenue` returns exactly one provider per scope; #729 Fork 3 added **per-check routing** —
 * feature checks resolved by one source, capacity by another, network by a third. Fork 3-A ruled this is
 * a `{ domain → provider }` map that dispatches each query to its configured source, routed by **coarse
 * domain** (the enumerable registration unit), never per-id. By-domain is **non-restrictive**: register
 * the same provider for every domain and the router collapses to single-provider behaviour — it adds a
 * capability without imposing an obligation (the most-flexible-default principle).
 *
 * Two pieces ship here:
 *   • {@link ByDomainRouter} — the generic, interface-agnostic by-domain map (the "one built thing" the
 *     ruling describes). The same mechanism instantiates over any provider interface — `CapabilityProvider`
 *     for the feature domain (single matrix today, so no composite is forced), `CapacityProvider` for the
 *     device-resource domains below.
 *   • {@link CompositeCapacityProvider} — the concrete realization: one `CapacityProvider` that routes each
 *     dimension's domain to its source (`compute` → native #767, `gpu` → #769, `network` → edge). Each
 *     domain has a single source today, so **no 3-B fallback/merge is needed** — that nests inside a slot
 *     later, additively, the first time a domain needs redundancy (#729: B composes with A, not against it).
 */
import {
  CAPACITY_DIMENSIONS,
  UnknownCapacityDimensionError,
  createNativeCapacityProvider,
  createEdgeCapacityProvider,
  type CapacityProvider,
  type CapacityDimensionId,
  type CapacityReading,
  type CapacityAdapter,
  type CapacityHints,
} from './capacity.js';
import { createGpuCapacityProvider, type GpuTierProbe } from './capacity-gpu.js';

/**
 * A generic by-domain router: a `{ domain → provider }` map with a single dispatch point. Interface-
 * agnostic — the concrete composites below delegate their interface methods through {@link route}.
 * Registering one provider under every domain collapses dispatch to that single provider.
 */
export class ByDomainRouter<Domain extends string, P> {
  #slots: Map<Domain, P>;

  constructor(slots: Partial<Record<Domain, P>>) {
    this.#slots = new Map(Object.entries(slots) as [Domain, P][]);
  }

  /** The provider configured for `domain`, or `undefined` if that domain has no source. */
  route(domain: Domain): P | undefined {
    return this.#slots.get(domain);
  }

  /** The domains that have a configured provider. */
  domains(): Domain[] {
    return [...this.#slots.keys()];
  }

  /** The distinct provider instances across all slots (deduped by identity). */
  providers(): P[] {
    return [...new Set(this.#slots.values())];
  }
}

/** The coarse capacity domains — the enumerable routing unit (#729 Fork 3-A: by-domain, not per-id). */
export type CapacityDomain = 'compute' | 'gpu' | 'network';

/**
 * Which domain owns each capacity dimension. Ownership (which source answers) is orthogonal to
 * availability-in-a-venue (the `undefined`-degrade contract) — so `deviceMemory` belongs to `compute`
 * (a device resource) even though it can *also* be read at the edge; routing decides the source, the
 * degrade contract decides whether that source can answer here.
 */
export const CAPACITY_DIMENSION_DOMAIN: Record<CapacityDimensionId, CapacityDomain> = {
  hardwareConcurrency: 'compute',
  deviceMemory: 'compute',
  gpuTier: 'gpu',
  effectiveType: 'network',
  saveData: 'network',
};

const UNKNOWN_READING = (dimension: CapacityDimensionId): CapacityReading => ({
  dimension,
  scalar: undefined,
  bucket: undefined,
});

/**
 * A composite {@link CapacityProvider} that routes each dimension to the provider registered for its
 * domain. Implements the same interface as a single provider, so the venue selection and any capacity
 * consumer run unchanged. A dimension whose domain has no configured provider reads as unknown
 * (degrade contract) rather than throwing.
 */
export class CompositeCapacityProvider implements CapacityProvider {
  #router: ByDomainRouter<CapacityDomain, CapacityProvider>;

  constructor(slots: Partial<Record<CapacityDomain, CapacityProvider>>) {
    this.#router = new ByDomainRouter(slots);
  }

  read(dimension: CapacityDimensionId): CapacityReading {
    const domain = CAPACITY_DIMENSION_DOMAIN[dimension];
    if (!domain) throw new UnknownCapacityDimensionError(dimension);
    const provider = this.#router.route(domain);
    return provider ? provider.read(dimension) : UNKNOWN_READING(dimension);
  }

  readAll(): CapacityReading[] {
    return CAPACITY_DIMENSIONS.map((d) => this.read(d.id));
  }

  dimensions(): CapacityDimensionId[] {
    // The composite knows the whole vocabulary; an unconfigured domain's dims just read unknown.
    return CAPACITY_DIMENSIONS.map((d) => d.id);
  }

  adapters(): CapacityAdapter[] {
    // The union of every routed provider's registered adapter rows, deduped by id.
    const seen = new Set<string>();
    const rows: CapacityAdapter[] = [];
    for (const provider of this.#router.providers())
      for (const row of provider.adapters())
        if (!seen.has(row.id)) {
          seen.add(row.id);
          rows.push(row);
        }
    return rows;
  }

  isNative(impl: string): boolean {
    return this.#router.providers().some((p) => p.isNative(impl));
  }
}

/** Config for the default composite capacity wiring. */
export interface CompositeCapacityConfig {
  /** Override the navigator the compute (native) source reads (tests / SSR). */
  navigator?: Navigator;
  /** Client Hints the network (edge) source reads. */
  hints?: CapacityHints;
  /** Inject the GPU probe (tests avoid real WebGL); omit to use detect-gpu. */
  gpuProbe?: GpuTierProbe;
}

/**
 * Wire the default by-domain capacity composite: `compute` → native (#767), `gpu` → the detect-gpu
 * source (#769), `network` → edge Client Hints (#767). Returns the provider plus the GPU probe's
 * `ready` promise (await it before reading `gpuTier`; every other dimension is synchronous).
 */
export function createCompositeCapacityProvider(
  config: CompositeCapacityConfig = {},
): { provider: CompositeCapacityProvider; ready: Promise<void> } {
  const compute = createNativeCapacityProvider(config.navigator);
  const network = createEdgeCapacityProvider(config.hints ?? {});
  const { provider: gpu, ready } = createGpuCapacityProvider(config.gpuProbe);
  const provider = new CompositeCapacityProvider({ compute, gpu, network });
  return { provider, ready };
}
