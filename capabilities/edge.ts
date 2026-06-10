/**
 * Edge module-as-a-service venue (#208) — broad targets, smallest payload, cached. This is the
 * resolution layer the module-as-a-service thread was missing
 * ([#087](/backlog/087-module-service-distribution-caching/),
 * [#088](/backlog/088-module-service-versioning/),
 * [#085](/backlog/085-validation-adapters-multi-language/)).
 *
 * Four properties, all from the #203 ruling:
 *   1. **Capabilities ride in the component URL** — `/c/droplist@1?caps=…` — using #204's
 *      URL-serializable capability ids (bounded, stable, compact Baseline keys). See {@link componentUrl}.
 *   2. **The client signal is read server-side via Client Hints, _not_ UA sniffing.** {@link ClientHints}
 *      is a *declared* capability/baseline profile (what a real edge maps `Sec-CH-UA*` headers onto), not
 *      a parsed UA string. {@link clientHintsSupport} turns it into the venue's {@link PlatformSupport}.
 *   3. **The chunk is cached per capability-equivalence class, not raw UA.** Two clients whose hints
 *      resolve to the *same supported subset* of the requested capabilities share one chunk
 *      ({@link equivalenceClass} / {@link EdgeChunkCache}) — far fewer chunks than one-per-UA.
 *   4. **Progressive enhancement** — the server *guesses* support from hints; `degrade` makes a wrong
 *      guess lower a tier (the resolver picks a heavier-but-working impl, or strictness reports it),
 *      so a wrong guess degrades rather than breaks.
 *
 * The provider is a {@link DegradingProvider} — same mechanism as runtime, only the support signal
 * differs (a Client-Hints lookup instead of live feature detection), and the same #205 resolver runs.
 */
import type { Capability } from './provider.js';
import type { CapabilityProvider } from './provider.js';
import { resolveSlot, requiredCapabilitiesFor, type Resolution, type Slot } from './resolver.js';
import { DegradingProvider, type PlatformSupport } from './venues.js';

/**
 * The server-side client signal — a **declared capability/baseline profile**, the structured shape a
 * real edge derives from Client-Hints headers (`Sec-CH-UA`, `Sec-CH-UA-Platform`, …). It is *not* a UA
 * string to sniff; it states what the client supports:
 *   - `baselineYear` — the Baseline epoch the client meets; a capability whose `baseline` year is ≤ this
 *     is assumed supported.
 *   - `supports` / `lacks` — fine-grained overrides for not-yet-Baseline (or known-broken) capabilities,
 *     beating the year heuristic either way.
 */
export interface ClientHints {
  /** The Baseline epoch the client meets (e.g. 2024). A capability with `baseline ≤ year` is assumed present. */
  baselineYear?: number;
  /** Capability ids the client definitely has (beats the year heuristic — for not-yet-Baseline features). */
  supports?: string[];
  /** Capability ids the client definitely lacks (beats the year heuristic — known-missing/broken). */
  lacks?: string[];
}

/**
 * Turn Client Hints into the venue's {@link PlatformSupport}, server-side. Unlike runtime's signal,
 * this is **total** (always `true`/`false`, never `undefined`): the edge commits to a guess per
 * capability — which is exactly what progressive enhancement then has to survive. The order of
 * precedence is explicit override (`lacks` → `supports`) then the Baseline-year heuristic.
 */
export function clientHintsSupport(hints: ClientHints, vocabulary: Capability[]): PlatformSupport {
  const lacks = new Set(hints.lacks ?? []);
  const supports = new Set(hints.supports ?? []);
  const baseline = new Map(vocabulary.map((c) => [c.id, c.baseline]));
  return (capabilityId) => {
    if (lacks.has(capabilityId)) return false;
    if (supports.has(capabilityId)) return true;
    const year = baseline.get(capabilityId);
    // not-yet-Baseline (`false`) and un-hinted → assume absent; otherwise compare the Baseline epoch.
    if (year === undefined || year === false) return false;
    return hints.baselineYear !== undefined && Number(year) <= hints.baselineYear;
  };
}

/**
 * The **capability-equivalence class** for a request: the requested capability ids plus which subset
 * the client supports. Two clients with the same string are equivalent — they get the same resolution,
 * so they share one cached chunk. Keyed on *resolved capabilities*, never the raw UA, so wildly
 * different UAs that happen to support the same features collapse to one class.
 *
 * Compact and stable: caps are sorted; each is suffixed `+` (supported) or `-` (absent). E.g.
 * `anchor-positioning-,popover+`.
 */
export function equivalenceClass(caps: string[], support: PlatformSupport): string {
  return [...caps]
    .sort()
    .map((cap) => `${cap}${support(cap) ? '+' : '-'}`)
    .join(',');
}

/**
 * The component chunk URL — capabilities ride in it as a sorted, comma-joined `caps` param (#204's
 * URL-serializable ids). The path carries the component + major version (the #088 versioning axis);
 * the query carries the requested capabilities (the cache dimension).
 */
export function componentUrl(component: string, version: number | string, caps: string[]): string {
  const sorted = [...caps].sort().join(',');
  return `/c/${component}@${version}?caps=${encodeURIComponent(sorted)}`;
}

/** One served chunk — the resolution plus its URL and the equivalence class it is cached under. */
export interface EdgeChunk {
  /** The resolved impl + reasoning (#205) for this equivalence class. */
  resolution: Resolution;
  /** The capability ids that drove the resolution (the URL `caps` param). */
  caps: string[];
}

/** A request the edge serves a chunk for. */
export interface EdgeRequest {
  component: string;
  version: number | string;
  /** The intents the component embodies — their union of required capabilities drives resolution. */
  intentIds: string[];
  /** The provider slot (a pin or a policy like `native-first`). */
  slot: Slot;
  /** The client signal, read server-side from Client Hints. */
  hints: ClientHints;
}

/** The result of serving a request — the chunk, where it lives, its cache class, and whether it was a hit. */
export interface EdgeServed {
  url: string;
  /** The capability-equivalence class this chunk is cached under (not the raw UA). */
  equivalenceClass: string;
  /** `${component}@${version}#${equivalenceClass}` — the full cache key. */
  cacheKey: string;
  chunk: EdgeChunk;
  /** True when this request reused an already-built chunk (a different UA in the same class). */
  fromCache: boolean;
}

/**
 * An edge chunk cache keyed by **capability-equivalence class**, the heart of the venue: it builds a
 * chunk once per (component, version, equivalence class) and shares it across every client that
 * resolves to the same class — so the number of chunks tracks distinct *capability sets*, not distinct
 * UAs. `serve` runs the whole flow: hints → support → required caps → equivalence class → URL →
 * resolve-or-reuse.
 */
export class EdgeChunkCache {
  readonly #base: CapabilityProvider;
  readonly #vocabulary: Capability[];
  readonly #chunks = new Map<string, EdgeChunk>();

  constructor(base: CapabilityProvider, vocabulary: Capability[]) {
    this.#base = base;
    this.#vocabulary = vocabulary;
  }

  /** Build the edge-venue provider for a given client (Client Hints → degraded view of the matrix). */
  providerFor(hints: ClientHints): DegradingProvider {
    return new DegradingProvider(this.#base, clientHintsSupport(hints, this.#vocabulary), this.#vocabulary);
  }

  /** Number of distinct chunks built so far — one per capability-equivalence class seen. */
  get size(): number {
    return this.#chunks.size;
  }

  /**
   * Serve a request: read the client signal, compute its equivalence class, and return the chunk for
   * that class — building it once and reusing it for every later client in the same class. The
   * resolution runs the unchanged #205 resolver against the degraded provider, so a wrong support guess
   * degrades (progressive enhancement), never breaks.
   */
  serve(request: EdgeRequest): EdgeServed {
    const provider = this.providerFor(request.hints);
    const support = clientHintsSupport(request.hints, this.#vocabulary);
    const caps = requiredCapabilitiesFor(provider, request.intentIds);
    const klass = equivalenceClass(caps, support);
    const cacheKey = `${request.component}@${request.version}#${klass}`;
    const url = componentUrl(request.component, request.version, caps);

    const cached = this.#chunks.get(cacheKey);
    if (cached) return { url, equivalenceClass: klass, cacheKey, chunk: cached, fromCache: true };

    const chunk: EdgeChunk = { resolution: resolveSlot(provider, request.slot, request.intentIds), caps };
    this.#chunks.set(cacheKey, chunk);
    return { url, equivalenceClass: klass, cacheKey, chunk, fromCache: false };
  }
}

/**
 * Build the edge-venue provider directly (no cache) — the architectural-ceiling matrix degraded by a
 * client's Client Hints. Most callers want {@link EdgeChunkCache} so chunks are shared per equivalence
 * class; this is the bare provider for one-off resolution or validation under a known client.
 */
export function createEdgeProvider(
  base: CapabilityProvider,
  vocabulary: Capability[],
  hints: ClientHints,
): DegradingProvider {
  return new DegradingProvider(base, clientHintsSupport(hints, vocabulary), vocabulary);
}
