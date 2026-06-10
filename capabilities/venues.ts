/**
 * Resolution venues — the configurable *where/when* dimension of epic #203 (story #208).
 *
 * The capability provider answers "can impl X serve capability Y, at what tier?". **Where that answer
 * is computed is a dimension, not a fixed mechanic** (#203 / #025): three legitimate end-states share
 * one interface and one resolver, differing only in where and when they run.
 *
 *   - **`build`** — known/narrow targets, zero runtime cost. The default. Reads the static build-matrix
 *     (`StaticMatrixProvider`, #204) as authored.
 *   - **`runtime`** — unknown targets, no infra. Tiers each capability by testing the **actual UA** at
 *     runtime (`CSS.supports`, `'popover' in HTMLElement.prototype`, …). Most accurate (see `runtime.ts`).
 *   - **`edge`** — broad targets, smallest payload, cached. A module-as-a-service venue
 *     ([#087](/backlog/087-module-service-distribution-caching/),
 *     [#088](/backlog/088-module-service-versioning/),
 *     [#085](/backlog/085-validation-adapters-multi-language/)): capabilities ride in the component URL,
 *     the client signal is read **server-side via Client Hints (never UA sniffing)**, and the chunk is
 *     **cached per capability-equivalence class** (see `edge.ts`).
 *
 * The `build` default is set in the base definition and overridable per project (the D6 cascade in
 * `cascade.ts` carries the resolved provider context). The same `native-first` resolver (#205) runs in
 * every venue — `resolveAtVenue` proves it: pick the venue's provider, then resolve unchanged.
 *
 * **The shared mechanism is `degrade`.** The static matrix tier is an impl's *architectural ceiling*
 * (its best achievable tier assuming the platform feature exists). The runtime and edge venues both
 * lower that ceiling by **live platform reality** — they differ only in *where the reality signal comes
 * from* (live feature detection vs. a Client-Hints lookup). `DegradingProvider` wraps a base provider
 * with any {@link PlatformSupport} source, so both venues are one mechanism over two signal sources.
 */
import type { Capability, Tier } from './provider.js';
import {
  resolveSlot,
  type Resolution,
  type Slot,
} from './resolver.js';
import type { CapabilityProvider } from './provider.js';

/** The three resolution venues (#203). `build` is the base default. */
export type Venue = 'build' | 'runtime' | 'edge';

export const VENUES: readonly Venue[] = ['build', 'runtime', 'edge'];

/** The base-definition default venue — zero runtime cost, known targets (#203). */
export const DEFAULT_VENUE: Venue = 'build';

/** A capability's polyfillability class, from the vocabulary (`capabilities.json`). */
export type PolyfillClass = Capability['polyfill'];

/**
 * Does the live platform (or a hinted client) serve a capability *natively*?
 *   - `true`  — natively supported; the impl's architectural ceiling stands.
 *   - `false` — absent; a native-ok cell degrades by the capability's polyfill class.
 *   - `undefined` — not knowable in this venue; fall back to the static matrix (no refinement).
 *
 * Runtime supplies this from feature detection; edge supplies it from Client Hints. Same shape, so the
 * same {@link degrade} and {@link DegradingProvider} serve both.
 */
export type PlatformSupport = (capabilityId: string) => boolean | undefined;

/**
 * Lower an impl's architectural tier by live platform reality — the primitive both non-default venues
 * share. The static matrix tier is the *ceiling* assuming the platform feature exists; this venue knows
 * whether it actually does.
 *
 *   - `support === undefined` → the venue can't tell → trust the matrix (fall back to static, #204).
 *   - `support === true` → the platform has it → the architectural ceiling stands unchanged.
 *   - `support === false` → the native feature is absent. A cell that *wasn't* relying on native
 *     (`polyfill-ok` / `capability-hard`) is unaffected — it already shims or already walls. A
 *     **`native-ok`** cell degrades by how recoverable the feature is:
 *       - `capability` class (UA-privileged, no shim can reach it) → **`capability-hard`**;
 *       - `polyfillable` / `partial` (a shim recovers the behavior) → **`polyfill-ok`**.
 *
 * Degradation only ever *lowers* a tier — it can never promote one — so a venue's view is always a
 * conservative refinement of the authored ceiling. This is the progressive-enhancement guarantee: a
 * wrong guess about support degrades the tier (and the resolver picks a heavier-but-working impl, or
 * the strictness knob reports it), it never invents capability the impl doesn't have.
 */
export function degrade(
  architectural: Tier,
  support: boolean | undefined,
  polyfill: PolyfillClass,
): Tier {
  if (support === undefined) return architectural; // not detectable here → the matrix stands (#204)
  if (support === true) return architectural; // platform has it → ceiling unchanged
  if (architectural !== 'native-ok') return architectural; // not relying on native here → unaffected
  return polyfill === 'capability' ? 'capability-hard' : 'polyfill-ok'; // native-ok with no native → degrade
}

/**
 * A capability provider that **refines a base provider by live platform reality**. It defers every
 * structural question (which impls exist, the native marker, the intent→capabilities map, the adapter
 * rows) to the wrapped base, and overrides only `tier()`: it reads the base's architectural ceiling
 * and {@link degrade}s it through a {@link PlatformSupport} signal.
 *
 * This *is* the runtime and edge venues' provider — they construct it with different support sources
 * (live feature detection vs. a Client-Hints lookup). One mechanism, two signals.
 */
export class DegradingProvider implements CapabilityProvider {
  readonly #base: CapabilityProvider;
  readonly #support: PlatformSupport;
  readonly #polyfillClass: Map<string, PolyfillClass>;

  /**
   * @param base       the architectural-ceiling provider (the static build-matrix, normally)
   * @param support    the live platform-support signal for this venue
   * @param vocabulary the capability vocabulary — supplies each capability's polyfill class for {@link degrade}
   */
  constructor(base: CapabilityProvider, support: PlatformSupport, vocabulary: Capability[]) {
    this.#base = base;
    this.#support = support;
    this.#polyfillClass = new Map(vocabulary.map((c) => [c.id, c.polyfill]));
  }

  tier(impl: string, capabilityId: string): Tier {
    const architectural = this.#base.tier(impl, capabilityId); // throws on unknown impl/capability — same as build
    const polyfill = this.#polyfillClass.get(capabilityId) ?? 'polyfillable';
    return degrade(architectural, this.#support(capabilityId), polyfill);
  }

  // Structure is venue-independent — defer wholesale to the base provider.
  requiredCapabilities(intentId: string): string[] {
    return this.#base.requiredCapabilities(intentId);
  }
  impls(): string[] {
    return this.#base.impls();
  }
  adapters() {
    return this.#base.adapters();
  }
  isNative(impl: string): boolean {
    return this.#base.isNative(impl);
  }
}

/** What `providerForVenue` needs to build a non-default venue's provider. */
export interface VenueConfig {
  /** The architectural-ceiling base provider — the static build-matrix (#204). Required for every venue. */
  base: CapabilityProvider;
  /** The capability vocabulary, for the polyfill class `degrade` reads. Required for runtime/edge. */
  vocabulary: Capability[];
  /** The live platform-support signal. `runtime` → feature detection; `edge` → a Client-Hints lookup. */
  support?: PlatformSupport;
}

/**
 * Select the provider impl for a venue — the routing the venue dimension turns into. `build` returns
 * the base as-authored; `runtime`/`edge` wrap it in a {@link DegradingProvider} over the venue's
 * support signal. (The `runtime` and `edge` modules supply ready-made constructors that fill in the
 * support source; this is the low-level switch they share.)
 */
export function providerForVenue(venue: Venue, config: VenueConfig): CapabilityProvider {
  if (venue === 'build') return config.base;
  if (!config.support)
    throw new Error(`venue "${venue}" needs a platform-support signal — none was provided`);
  return new DegradingProvider(config.base, config.support, config.vocabulary);
}

/**
 * Resolve a slot **at a chosen venue** — the proof that the venue dimension changes only *where* the
 * tiers come from, never the resolution logic. Picks the venue's provider, then runs the unchanged
 * #205 `resolveSlot`. `build` reads the matrix; `runtime`/`edge` resolve against the degraded view.
 */
export function resolveAtVenue(
  venue: Venue,
  config: VenueConfig,
  slot: Slot,
  intentIds: string[],
): Resolution {
  return resolveSlot(providerForVenue(venue, config), slot, intentIds);
}
