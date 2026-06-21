# Server-state query/cache lifecycle placement survey

Prior-art survey grounding decision [#1419](/backlog/1419-server-state-query-cache-lifecycle-fetch-dedupe-cache-stalen/)
(surfaced by the data-lifecycle lens [#1403](/backlog/1403-discovery-lens-data-lifecycle-paradigms-load-cache-mutate-sy/)).
Per design-first step 1, prior art is gathered before the forks are framed so the dimensions reuse
platform vocabulary.

## The concern

The **server-state cache lifecycle** that TanStack Query / SWR / RTK Query / Apollo all converged on — a
keyed query cache with **staleness/TTL**, **in-flight de-dupe**, **invalidate/refresh**,
**background-refetch**, and **query dependency** — has no WE owner. It is the read-path counterpart to
optimistic mutation ([#1395](/backlog/1395-optimistic-mutation-apply-reconcile-rollback-standard-placem/),
prepared). The card asks: a `query`/`server-state` intent over a swappable cache provider, vs extending
`resource-loader`/`loader` with cache+staleness traits, vs a headless `simple-store`-adjacent block.

## Native grounding — borrow the platform vocabulary

The platform already standardizes this lifecycle at the HTTP layer:

- **`Cache-Control` (RFC 9111 + RFC 5861)** — `max-age=N` = the **fresh window** (TanStack `staleTime`);
  after it the entry is stale but usable. **`stale-while-revalidate=N`** = serve stale immediately while
  revalidating in the background — *the exact SWR pattern, named at the protocol level*. `stale-if-error`
  maps to the failure seam (`reliability`).
- **Cache API / `CacheStorage`** — the platform's keyed request→response store (`match`/`put`/`delete`);
  the natural model for a **swappable cache provider**.
- **`AbortController`/`AbortSignal`** — the cancellation primitive `resource-loader` already uses; the cache
  composes it for in-flight dedupe.
- Canonical vocabulary to standardize on (platform-first): *query key*, *fresh* vs *stale* with a fresh
  window (`max-age`/`staleTime`), *revalidate* (prefer the RFC verb over "refetch"),
  *stale-while-revalidate*, *evict/garbage-collect* (`gcTime`), *invalidate*, *dependent query*, *fetch
  policy* (cache-first / network-only / cache-and-network), *in-flight dedupe*, *normalized cache*.

## Finding 1 (load-bearing) — four libraries converged on ONE model with different vocabulary

The strong intent-abstraction signal (the #1405 divergence-pass insight: same model, different vocab):

| Shared concept | TanStack Query | SWR | RTK Query | Apollo |
|---|---|---|---|---|
| Cache key | `queryKey` | `key` | endpoint+args | normalized ID |
| Fresh window | `staleTime` | dedupe window | (tags) | (policy) |
| Unused-entry GC | `gcTime` | unmount | `keepUnusedDataFor` | `cache.gc()` |
| In-flight dedupe | by key | `dedupingInterval` | by key | by query |
| Invalidate | `invalidateQueries` | `mutate(key)` | tag `invalidatesTags` | `evict`/`refetchQueries` |
| Background revalidate | on focus/reconnect | `revalidateOnFocus` | on subscription | `cache-and-network` |
| Dependent query | `enabled` | conditional key | `skip` | `skip` |

The model: **a keyed store of `{data, status, freshUntil}` entries, with de-duped in-flight fetches,
staleness-driven background revalidation, on-demand invalidation, and unused-entry GC.** Same model, four
vocabularies → textbook intent-abstraction. Refs:
[TanStack QueryClient](https://tanstack.com/query/latest/docs/reference/QueryClient),
[SWR](https://swr.vercel.app/docs/api),
[RTK Query automated re-fetching](https://redux-toolkit.js.org/rtk-query/usage/automated-refetching),
[Apollo fetch policies](https://www.apollographql.com/docs/react/data/queries/#supported-fetch-policies).

## Finding 2 — the fresh/stale split is two independent timers, both platform-named

`staleTime`/`max-age` (when to *revalidate*) is orthogonal to `gcTime`/`keepUnusedDataFor` (when to
*evict*); the TanStack docs explicitly disambiguate them. The contract must expose both as distinct
dimensions. **SWR is literally named after `stale-while-revalidate` (RFC 5861)** — the library convergence
*descends from* the platform vocabulary, so native-first alignment is the lineage, not a retrofit.

## Finding 3 — invalidation is the read↔write seam, already half-pointed-at in WE

The write path invalidates read-path entries (`invalidateQueries` / `invalidatesTags` / `mutate` /
`refetchQueries`). WE's [we:src/_data/blocks/resource-action.json](../src/_data/blocks/resource-action.json)
already lists `invalidateQueries` as a TanStack pattern it mirrors — but has **no cache to invalidate**,
confirming the residual is a real, named gap the write side already points at. (#1395 is the *prepared*
write-path decision; this is its read-path counterpart.)

## WE-tree decomposition — WE owns one-fetch UI state, not a cross-query cache

- **[we:src/_data/intents/loader.json](../src/_data/intents/loader.json)** — pending-state *UX* profiles
  (blocking strategy, scope, threshold/anti-flicker, escalation, a 7-state lifecycle). Its `stale` state
  means "showing previous data while a refresh is in progress" — the *display* of staleness for one
  operation, with a per-operation version token (a single-fetch race guard), **no key, no cross-query
  store**.
- **[we:src/_data/blocks/resource-loader.json](../src/_data/blocks/resource-loader.json)** — the single-fetch
  orchestrator; it has a `withStaleWhileRevalidate` trait (keeps *previously-rendered* content visible
  during one refresh) and *cites* `staleTime`/`gcTime`/dedupe in a framework comparison, but it does **not
  cache across calls**. It is "trait-based async state management" for **one** operation.
- **[we:src/_data/intents/prefetch.json](../src/_data/intents/prefetch.json)** — *eagerness* only
  (viewport/hover/interaction); owns no cache or staleness.
- **[we:src/_data/blocks/simple-store.json](../src/_data/blocks/simple-store.json)** — a generic reactive
  *client-state* store (paths, derived state); no keys, no staleness, no fetch/revalidate. Not a
  server-state cache.
- No `query`/`server-state`/`cache` intent or block exists (grep: cache mentions are router/view keep-alive
  or single-fetch trait language).

**Precise unowned residual:** a **shared, keyed, staleness-aware cache *across* queries** — `key → {data,
freshUntil, status, revalidate()}` — with in-flight dedupe, background revalidation, on-demand
invalidation, dependent-query gating, and unused-entry GC. WE owns one-fetch UI state (`loader` /
`resource-loader`), eagerness (`prefetch`), and client state (`simple-store`) — nothing models the
cross-query server-state cache the four libraries converged on.

## Recommended placement

- **Fork 1 — home:** mint a first-class **`query` (server-state) intent** abstracting the cache-lifecycle
  contract `key → {data, staleness, revalidate}` over a swappable cache provider (~85%). Extending
  `resource-loader`/`loader` is the **broken** branch — those model *one fetch's UI state* (a per-operation
  version token, blocking strategy, anti-flicker); a cross-query *shared keyed store* is a different concern
  (a store, not a fetch). This is the symmetric mistake #1395 untangled on the write side (it found
  `loader.strategy.optimistic` was wrongly hosting the write lifecycle). The cache *provider* may be
  store-shaped, but the *contract* is an intent. Dimensions borrow platform vocabulary (`fetchPolicy`,
  `freshWindow`/staleTime, `evictAfter`/gcTime, `revalidateOn`, `dedupe`, `dependsOn`).
- **Fork 1-sub — swappable provider (protocol):** the cache is a **swappable runtime-DI provider behind the
  contract** (~85%); baking one cache impl is the broken branch (forecloses the Cache API, an in-memory
  map, or a normalized entity store — violates protocol-is-the-only-lock). The `key → {data, staleness,
  revalidate}` interface is the lock; the impl is DI-injected. Normalized (entity-level) caching is an
  optional provider capability, not mandated.

Relationship to #1395 (supported, not a fork): this is the **read-path symmetric counterpart** to #1395's
*prepared* write-path mutation decision. They compose — a mutation *invalidates* `query` cache entries and
optimistically writes a predicted result *into* the cache — completing a clean three-way: `loader`
(single-fetch *UI*), `query` (cross-query *cache*, reads), and the proposed mutation lifecycle (writes).
Follow #1395's precedent: a contract-placement decision yielding a new intent + a retarget of an existing
FUI block, not a greenfield build.

Supported by default: the running cache stays in FUI (a `resource-cache` block or `resource-loader`
extension); `query` composes `loader` for per-entry display states (it owns the *store* of staleness,
loader owns the *display*); fetch-policy is an author-configurable dimension, most-permissive default
**cache-and-network** (the `stale-while-revalidate` default the platform blesses); `prefetch` composes
`query` (eagerness populates cache entries); dependent queries = a `dependsOn`/`enabled` gate; normalized
caching = an optional provider capability.

Suggested research-topic home: `webresources` (matches #1395's `optimistic-mutation-lifecycle` — the
read/write pair belongs in one project; `webresources` = "protocols for data exchange, interceptors,
resource definition"). The cache *provider* is store-shaped (a `webstates` seam), but the intent's home is
the resource-exchange concern.
