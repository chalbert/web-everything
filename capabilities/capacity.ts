/**
 * Capacity provider — the device-resource sibling of {@link CapabilityProvider} (#767, building the
 * ratified #729 Fork 1 + 2).
 *
 * Where the capability provider answers *"can impl X serve capability Y, at what tier?"* over a bounded
 * Baseline vocabulary, the capacity provider answers *"how much of resource Z does the device have?"*
 * over **scalar runtime measurements** — `navigator.hardwareConcurrency`, `navigator.deviceMemory`,
 * `navigator.connection.effectiveType` / `saveData`, GPU tier. #729 Fork 1 ruled these get their **own
 * contract beside** `CapabilityProvider` (categorically unlike its 3-state `Tier` union), not an
 * overload — but **reuse the same machinery**: the `Venue` dimension and the `undefined`-means-unknown
 * degrade contract from {@link ./venues}, and the central registered-adapter table (#206).
 *
 * #729 Fork 2 ruled each read answers **both** shapes: the raw scalar (`deviceMemory: 8`) *and* a
 * derived coarse bucket (`high`/`mid`/`low`) — the prior-art adaptive-loading combinators all bucket a
 * raw measurement, and a consumer needs the scalar to compute and the bucket to branch.
 *
 * This module ships the **vocabulary**, the **contract**, and the **native default impl** (CPU / RAM /
 * network reads from `navigator`, plus the edge read from Client Hints). The **GPU-tier impl** (its one
 * `detect-gpu` dependency) and the **composite router** (route each dimension to a different source) are
 * the separately-prioritized spin-offs of the #729 build chain — a capacity source simply reports
 * `undefined` (unknown) for a dimension it can't read, per the degrade contract.
 */
import type { Venue } from './venues.js';

/** A capacity dimension id — borrows the official platform API / Client-Hint names verbatim. */
export type CapacityDimensionId =
  | 'hardwareConcurrency'
  | 'deviceMemory'
  | 'effectiveType'
  | 'saveData'
  | 'gpuTier';

/** The coarse bucket every capacity read derives from its raw scalar (#729 Fork 2). */
export type CapacityBucket = 'high' | 'mid' | 'low';

export const CAPACITY_BUCKETS: readonly CapacityBucket[] = ['high', 'mid', 'low'];

/** The raw scalar a dimension measures — a count, a class string, or a flag (`undefined` = unknown). */
export type CapacityScalar = number | string | boolean | undefined;

/** One entry of the capacity vocabulary — the adaptive-loading rows, official names (#729). */
export interface CapacityDimension {
  id: CapacityDimensionId;
  label: string;
  /** The official platform API and/or Client Hint this dimension reads (e.g. `Sec-CH-Device-Memory`). */
  platformSource: string;
  /** What the raw scalar measures (`logical-cores`, `gibibytes`, `effective-connection-type`, …). */
  unit: string;
  /** Venues that can resolve this dimension. Runtime-only signals (cores, GPU) are absent at the edge. */
  venues: Venue[];
  summary: string;
}

/**
 * The adaptive-loading vocabulary (#729 survey). `deviceMemory` / `effectiveType` / `saveData` also
 * resolve at the **edge** (`Sec-CH-Device-Memory` / `ECT` / `Save-Data` Client Hints); cores and GPU
 * tier are **runtime-only** — no request header carries them.
 */
export const CAPACITY_DIMENSIONS: readonly CapacityDimension[] = [
  {
    id: 'hardwareConcurrency',
    label: 'Logical CPU cores',
    platformSource: 'navigator.hardwareConcurrency',
    unit: 'logical-cores',
    venues: ['runtime'],
    summary:
      'Number of logical processors available to run threads — the headroom for parallel work ' +
      '(workers, decoding). Runtime-only; no request header carries it.',
  },
  {
    id: 'deviceMemory',
    label: 'Device memory',
    platformSource: 'navigator.deviceMemory / Sec-CH-Device-Memory',
    unit: 'gibibytes',
    venues: ['runtime', 'edge'],
    summary:
      'Approximate device RAM in GiB, coarsened by the platform to a privacy-safe set ' +
      '(0.25 / 0.5 / 1 / 2 / 4 / 8). Also resolves at the edge via the Sec-CH-Device-Memory hint.',
  },
  {
    id: 'effectiveType',
    label: 'Effective connection type',
    platformSource: 'navigator.connection.effectiveType / ECT',
    unit: 'effective-connection-type',
    venues: ['runtime', 'edge'],
    summary:
      'The Network Information API round-trip/throughput class — `slow-2g` | `2g` | `3g` | `4g`. ' +
      'Also resolves at the edge via the ECT Client Hint.',
  },
  {
    id: 'saveData',
    label: 'Data-saver preference',
    platformSource: 'navigator.connection.saveData / Save-Data',
    unit: 'boolean',
    venues: ['runtime', 'edge'],
    summary:
      'User opt-in to reduced data usage. When true, treat the device as low-headroom regardless of ' +
      'raw resources. Also resolves at the edge via the Save-Data header.',
  },
  {
    id: 'gpuTier',
    label: 'GPU tier',
    platformSource: 'WebGL / WebGPU adapter probe (detect-gpu)',
    unit: 'gpu-tier',
    venues: ['runtime'],
    summary:
      'Coarse GPU capability class for gating expensive visual effects. The probing impl is the ' +
      'separately-prioritized #729 GPU-tier spin-off; the native source reports it as unknown.',
  },
];

/** A single capacity read: BOTH the raw scalar AND the derived coarse bucket (#729 Fork 2). */
export interface CapacityReading {
  dimension: CapacityDimensionId;
  /** The raw measurement (`deviceMemory: 8`). `undefined` = not knowable in this venue/UA. */
  scalar: CapacityScalar;
  /** The coarse bucket derived from the scalar. `undefined` when the scalar is unknown. */
  bucket: CapacityBucket | undefined;
}

/**
 * One **registered capacity adapter** — a row of the central adapter table, exactly the #206 shape the
 * capability matrix uses (ownership distributed, storage central). A row declares which dimensions its
 * source can read; the native row reads CPU / RAM / network, the edge row reads the hint-backed subset.
 */
export interface CapacityAdapter {
  id: string;
  label: string;
  summary: string;
  /** Is this the native (in-browser) source? Mirrors the capability table's native marker. */
  native?: boolean;
  /** The dimensions this source can resolve. */
  dimensions: CapacityDimensionId[];
}

/**
 * A capacity source — the venue-specific raw read. `runtime` reads `navigator`; `edge` reads Client
 * Hints. Returns `undefined` for any dimension it can't resolve, so the same {@link deriveBucket} and
 * provider serve every venue (the `undefined`-means-unknown degrade contract, reused from `venues.ts`).
 */
export type CapacitySource = (dimension: CapacityDimensionId) => CapacityScalar;

/**
 * Derive the coarse bucket from a raw scalar — the single place the scalar→bucket policy lives, so
 * every source buckets identically. Thresholds follow the adaptive-loading prior art (#729 survey).
 * Returns `undefined` for an unknown scalar (degrade contract).
 */
export function deriveBucket(
  dimension: CapacityDimensionId,
  scalar: CapacityScalar,
): CapacityBucket | undefined {
  if (scalar === undefined) return undefined;
  switch (dimension) {
    case 'hardwareConcurrency':
    case 'deviceMemory': {
      const n = Number(scalar);
      if (!Number.isFinite(n)) return undefined;
      if (n >= 8) return 'high';
      if (n >= 4) return 'mid';
      return 'low';
    }
    case 'effectiveType':
      if (scalar === '4g') return 'high';
      if (scalar === '3g') return 'mid';
      if (scalar === '2g' || scalar === 'slow-2g') return 'low';
      return undefined;
    case 'saveData':
      // Data-saver on → treat as low-headroom; off → no constraint signalled.
      return scalar ? 'low' : 'high';
    case 'gpuTier': {
      // The GPU-tier impl (a #729 spin-off) emits a bucket string directly; accept it verbatim.
      const s = String(scalar) as CapacityBucket;
      return (CAPACITY_BUCKETS as readonly string[]).includes(s) ? s : undefined;
    }
    default:
      return undefined;
  }
}

export class UnknownCapacityDimensionError extends Error {
  constructor(dimension: string) {
    super(`Unknown capacity dimension "${dimension}" — not in the capacity vocabulary`);
    this.name = 'UnknownCapacityDimensionError';
  }
}

/** The injectable contract every venue's capacity provider satisfies — sibling of `CapabilityProvider`. */
export interface CapacityProvider {
  /** Read one dimension: both its raw scalar and derived bucket. */
  read(dimension: CapacityDimensionId): CapacityReading;
  /** Read every dimension in the vocabulary (unknown dimensions report `undefined`/`undefined`). */
  readAll(): CapacityReading[];
  /** The vocabulary dimension ids this provider knows. */
  dimensions(): CapacityDimensionId[];
  /** The registered capacity adapter rows (#206) — for discovery surfaces. */
  adapters(): CapacityAdapter[];
  /** Is `impl` a native (in-browser) source? */
  isNative(impl: string): boolean;
}

const KNOWN_DIMENSIONS = new Set(CAPACITY_DIMENSIONS.map((d) => d.id));

/**
 * The default provider: a registered adapter table + a {@link CapacitySource} that does the raw read.
 * Buckets are derived centrally, so swapping the source (native ⇄ edge ⇄ a future composite) changes
 * only *where the scalars come from*, never the bucketing — the exact venue-dimension invariant the
 * capability resolver proves for tiers.
 */
export class SourceCapacityProvider implements CapacityProvider {
  #adapters: CapacityAdapter[];
  #source: CapacitySource;
  #native: Set<string>;

  constructor(adapters: CapacityAdapter[], source: CapacitySource) {
    this.#adapters = adapters;
    this.#source = source;
    this.#native = new Set(adapters.filter((a) => a.native).map((a) => a.id));
  }

  read(dimension: CapacityDimensionId): CapacityReading {
    if (!KNOWN_DIMENSIONS.has(dimension)) throw new UnknownCapacityDimensionError(dimension);
    const scalar = this.#source(dimension);
    return { dimension, scalar, bucket: deriveBucket(dimension, scalar) };
  }

  readAll(): CapacityReading[] {
    return CAPACITY_DIMENSIONS.map((d) => this.read(d.id));
  }

  dimensions(): CapacityDimensionId[] {
    return CAPACITY_DIMENSIONS.map((d) => d.id);
  }

  adapters(): CapacityAdapter[] {
    return this.#adapters;
  }

  isNative(impl: string): boolean {
    return this.#native.has(impl);
  }
}

/** The native (in-browser) adapter row — reads CPU / RAM / network live from `navigator` (#206). */
export const NATIVE_CAPACITY_ADAPTER: CapacityAdapter = {
  id: 'native',
  label: 'Native (navigator)',
  summary:
    'In-browser source reading navigator.hardwareConcurrency, navigator.deviceMemory, and ' +
    'navigator.connection.* live. The default capacity impl; GPU tier is reported unknown (its probe ' +
    'is the #729 GPU-tier spin-off).',
  native: true,
  dimensions: ['hardwareConcurrency', 'deviceMemory', 'effectiveType', 'saveData'],
};

/** The edge adapter row — reads the hint-backed subset from Client Hints at the CDN (#206). */
export const EDGE_CAPACITY_ADAPTER: CapacityAdapter = {
  id: 'edge',
  label: 'Edge (Client Hints)',
  summary:
    'CDN-side source reading the Sec-CH-Device-Memory / ECT / Save-Data Client Hints. Cores and GPU ' +
    'tier are runtime-only, so it reports them unknown.',
  dimensions: ['deviceMemory', 'effectiveType', 'saveData'],
};

type NavigatorConnection = {
  effectiveType?: string;
  saveData?: boolean;
};

/**
 * The native capacity source — reads `navigator`, SSR/edge-safe. Any signal the running UA doesn't
 * expose (or that's absent server-side) reads as `undefined`, per the degrade contract. `gpuTier` is
 * always `undefined` here: its probe ships as the separately-prioritized #729 GPU-tier spin-off.
 */
export function nativeCapacitySource(nav: Navigator | undefined = globalThisNavigator()): CapacitySource {
  return (dimension) => {
    if (!nav) return undefined;
    const conn = (nav as Navigator & { connection?: NavigatorConnection }).connection;
    switch (dimension) {
      case 'hardwareConcurrency':
        return typeof nav.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : undefined;
      case 'deviceMemory':
        return typeof (nav as Navigator & { deviceMemory?: number }).deviceMemory === 'number'
          ? (nav as Navigator & { deviceMemory?: number }).deviceMemory
          : undefined;
      case 'effectiveType':
        return conn && typeof conn.effectiveType === 'string' ? conn.effectiveType : undefined;
      case 'saveData':
        return conn && typeof conn.saveData === 'boolean' ? conn.saveData : undefined;
      case 'gpuTier':
        return undefined;
      default:
        return undefined;
    }
  };
}

/** The capacity-relevant Client Hints an edge venue receives (`Sec-CH-Device-Memory` / `ECT` / `Save-Data`). */
export interface CapacityHints {
  deviceMemory?: number;
  effectiveType?: string;
  saveData?: boolean;
}

/** The edge capacity source — reads the hint-backed subset; runtime-only dimensions read `undefined`. */
export function edgeCapacitySource(hints: CapacityHints): CapacitySource {
  return (dimension) => {
    switch (dimension) {
      case 'deviceMemory':
        return typeof hints.deviceMemory === 'number' ? hints.deviceMemory : undefined;
      case 'effectiveType':
        return typeof hints.effectiveType === 'string' ? hints.effectiveType : undefined;
      case 'saveData':
        return typeof hints.saveData === 'boolean' ? hints.saveData : undefined;
      default:
        return undefined;
    }
  };
}

/** Wire the native (runtime) capacity provider — the default impl. */
export function createNativeCapacityProvider(nav?: Navigator): SourceCapacityProvider {
  return new SourceCapacityProvider([NATIVE_CAPACITY_ADAPTER], nativeCapacitySource(nav));
}

/** Wire the edge capacity provider over a venue's Client Hints. */
export function createEdgeCapacityProvider(hints: CapacityHints): SourceCapacityProvider {
  return new SourceCapacityProvider([EDGE_CAPACITY_ADAPTER], edgeCapacitySource(hints));
}

/**
 * Select the capacity provider for a venue — the capacity analogue of `providerForVenue`. `runtime`
 * reads `navigator`; `edge` reads Client Hints; `build` has no live device, so every read is unknown
 * (the static base venue carries no capacity signal). The composite router that mixes sources per
 * dimension is the #729 spin-off.
 */
export function capacityProviderForVenue(
  venue: Venue,
  config: { hints?: CapacityHints; navigator?: Navigator } = {},
): CapacityProvider {
  if (venue === 'edge') return createEdgeCapacityProvider(config.hints ?? {});
  if (venue === 'runtime') return createNativeCapacityProvider(config.navigator);
  // build: no live device — everything unknown.
  return new SourceCapacityProvider([], () => undefined);
}

function globalThisNavigator(): Navigator | undefined {
  return typeof navigator !== 'undefined' ? navigator : undefined;
}
