/**
 * resource-cache provider plane — the **pure-contract half** (#1460 slice B; query intent #1419).
 *
 * Types and interfaces only: this module is fully **compile-erased** (no runtime emit) so it can become
 * the `@webeverything/contracts/resource-cache` entry (#872/#874) that FUI depends on, superseding
 * byte-replication — the FUI→WE arrow, like `./resources` and `./validator-resolution`. The runtime half
 * — the default in-memory cache, the dedupe runner, the revalidation scheduler — is impl and lives in the
 * FUI `resource-cache` block (#1534, slice C; statute #1290: runtime in FUI, never the WE repo).
 *
 * The query (server-state) intent (#1419 amendment) is **UX-only**: it surfaces *what to fetch* and the
 * loading/error/empty states, never *how it is cached*. Caching is a swappable **runtime-DI** concern —
 * the running standard consults whichever {@link ResourceCacheProvider} is wired (#runtime-di-vs-devtools
 * seam) — so every technical knob (dedupe, fresh/evict windows, revalidation triggers, dependency
 * invalidation) lives here on the provider config, off the intent surface. Net-new: #1395 shipped the
 * resources protocol but no cache provider contract.
 *
 * The model is a keyed read returning `{ data, staleness, revalidate }`: a consumer asks the provider for
 * a key and gets the cached value, whether it is fresh or stale, and a hook to force a background refresh.
 * Vary the cache policy (LRU, TTL, persistent, SWR), never that read surface.
 */

/**
 * Identifies a cached resource. A plain string for simple cases, or a stable structured key the provider
 * serializes deterministically (so `['user', 7]` and `['user', 7]` hit the same entry). Opaque to the
 * plane — the provider owns serialization; consumers never inspect it.
 */
export type CacheKey = string | readonly (string | number | boolean | null)[];

/**
 * Freshness of a cached entry relative to the provider's {@link ResourceCacheConfig.freshWindow}.
 * `fresh` — within the window, serve as-is; `stale` — past it, serve but a revalidation is warranted
 * (stale-while-revalidate); `revalidating` — a background refresh is in flight; `missing` — no entry yet.
 */
export type Staleness = 'fresh' | 'stale' | 'revalidating' | 'missing';

/**
 * The events on which the provider should automatically revalidate a stale entry
 * ({@link ResourceCacheConfig.revalidateOn}). `focus` — window/tab regained focus; `reconnect` — the
 * network came back online; `mount` — a fresh consumer subscribed to the key; `interval` — the provider's
 * own timer (paired with a policy-defined period). The intent never sees these.
 */
export type RevalidateTrigger = 'focus' | 'reconnect' | 'mount' | 'interval';

/**
 * One cached resource as read by a consumer — the `{ data, staleness, revalidate }` core surface.
 * `data` is `undefined` only while `staleness === 'missing'`. `revalidate()` forces a background refresh
 * and resolves with the next value (or rejects if the refresh fails); calling it does not block the
 * current `data` from being served.
 */
export interface CacheEntry<T = unknown> {
  /** The cached value; `undefined` only when `staleness === 'missing'`. */
  readonly data: T | undefined;
  /** Freshness relative to {@link ResourceCacheConfig.freshWindow}. */
  readonly staleness: Staleness;
  /** Force a background refresh; resolves with the next value (rejects on failure). */
  revalidate(): Promise<T>;
}

/**
 * The technical knobs the query intent keeps **off** its UX surface (#1419 amendment) and routes here to
 * the provider. All optional — the provider supplies policy defaults. Windows are in milliseconds.
 */
export interface ResourceCacheConfig {
  /** Coalesce concurrent in-flight requests for the same key into one fetch (default on). */
  dedupe?: boolean;
  /** How long after a fetch an entry stays `fresh` before it becomes `stale`, in ms. */
  freshWindow?: number;
  /** How long after last use an idle entry is evicted (garbage-collected), in ms. */
  evictAfter?: number;
  /** Events that auto-revalidate a stale entry. */
  revalidateOn?: readonly RevalidateTrigger[];
  /**
   * Keys whose invalidation cascades to this one — when any `dependsOn` key is invalidated, this entry is
   * marked stale too (e.g. a list query depends on the items it contains).
   */
  dependsOn?: readonly CacheKey[];
}

/**
 * The injectable contract every cache impl satisfies — one interface, swappable runtime-DI impls
 * (in-memory LRU, TTL, persistent, SWR, a test double). `key` names it for registration / devtools
 * selection (#runtime-di-vs-devtools seam). The running query realization consults whichever provider is
 * wired; vary the policy freely, never this surface.
 *
 * - `read` returns the keyed `{ data, staleness, revalidate }` entry, minting a `missing` entry if absent.
 * - `write` seeds/replaces a value (e.g. an optimistic update or an out-of-band push), stamping it fresh.
 * - `invalidate` marks one or more keys stale (cascading to dependents per `dependsOn`) without evicting,
 *   so the next read serves stale-while-revalidate; omit `key` to invalidate everything.
 * - `subscribe` registers a listener fired whenever the entry for `key` changes (data or staleness),
 *   returning an unsubscribe handle — the seam a FUI block uses to re-render.
 */
export interface ResourceCacheProvider {
  /** Names this provider for registration / devtools selection. */
  readonly key: string;
  /** Read the keyed entry, applying `config` knobs; mints a `missing` entry if absent. */
  read<T = unknown>(key: CacheKey, config?: ResourceCacheConfig): CacheEntry<T>;
  /** Seed or replace a value, stamping it fresh. */
  write<T = unknown>(key: CacheKey, data: T): void;
  /** Mark key(s) stale (cascading to `dependsOn` dependents); omit `key` to invalidate all. */
  invalidate(key?: CacheKey): void;
  /** Subscribe to changes for a key; returns an unsubscribe handle. */
  subscribe(key: CacheKey, listener: (entry: CacheEntry) => void): () => void;
}
