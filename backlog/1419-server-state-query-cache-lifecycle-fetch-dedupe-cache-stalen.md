---
kind: decision
size: 3
parent: "099"
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#decompose-overloaded-vocabulary-by-semantic-source"
tags: [decision, book-candidate, data-lifecycle, server-state, cache, gap]
relatedReport: reports/2026-06-21-server-state-cache-lifecycle.md
preparedDate: "2026-06-21"
---

# Server-state query/cache lifecycle — fetch/dedupe/cache/staleness/invalidate standard: placement

## Ruling — ratified 2026-06-21 (~85%)

**Fork 1 (a):** mint a first-class **`query` (server-state) intent** as the home for the cross-query
cache lifecycle. Extending `resource-loader`/`loader` is rejected — single-fetch UI ≠ cross-query store
(the homonym trap #1395 untangled on the write side). **Name: `query`** (symmetric to the write-path
lifecycle, matches `useQuery`).

**Fork 1-sub (a):** the cache is a **swappable runtime-DI provider behind the `key → {data, staleness,
revalidate}` contract** (protocol). Baking one impl is rejected (forecloses Cache API / in-memory /
normalized — protocol-is-the-only-lock).

**Amendment (ratified, red-team result):** the **`query` intent surface is UX-only** per
*Intent UX-Only, Technical→Configurator*. The intent owns only what the user observes —
**`fetchPolicy`** (cache-first / network-only / `cache-and-network`) and the **staleness display**
(composing `loader`). The **technical lifecycle knobs ride the provider contract / Technical
Configurator**, not the intent: `dedupe`, exact `freshWindow`/`evictAfter` ms, `revalidateOn`,
`dependsOn` query-graph gating. (`loader`'s injector-resolved threshold ms are precedent for a thin
intent carrying a little tuning, but `dedupe`/`dependsOn` are clearly below the UX line.)

**Placement only** (graduatedTo: none) — mirrors #1395: the entity is authored as separately-prioritized
realizing work, filed below.

Surfaced by the data-lifecycle lens
([#1403](/backlog/1403-discovery-lens-data-lifecycle-paradigms-load-cache-mutate-sy/)): the **server-state
cache lifecycle** that TanStack Query / SWR / RTK Query / Apollo all converged on — a keyed query cache
with **staleness/TTL**, **in-flight de-dupe**, **invalidate/refresh**, **background-refetch**, and **query
dependency** — has no WE owner ([prior-art survey](/research/server-state-cache-lifecycle/)). This is the
read-path counterpart to optimistic mutation
([#1395](/backlog/1395-optimistic-mutation-apply-reconcile-rollback-standard-placem/), prepared).

The axis the prep pins to the real tree: WE owns the **UI state of one fetch**, not the **cross-query
cache**. [we:src/_data/intents/loader.json](../src/_data/intents/loader.json) is pending-state UX (its
`stale` state is the *display* of staleness for one operation, plus a per-operation version token — no key,
no store); [we:src/_data/blocks/resource-loader.json](../src/_data/blocks/resource-loader.json) is the
single-fetch orchestrator (its `withStaleWhileRevalidate` trait keeps previously-rendered content visible
during *one* refresh and only *cites* `staleTime`/`gcTime`/dedupe in a framework comparison — it does not
cache across calls); [we:src/_data/intents/prefetch.json](../src/_data/intents/prefetch.json) is eagerness;
[we:src/_data/blocks/simple-store.json](../src/_data/blocks/simple-store.json) is generic *client* state.
None models a **shared, keyed, staleness-aware cache across queries** — the actual library convergence
(four libraries, one model, different vocab; a strong intent-abstraction target per the #1405
divergence-pass). The platform already names the vocabulary: `Cache-Control` `max-age` (= the fresh
window / `staleTime`) and **`stale-while-revalidate`** (RFC 5861 — SWR is literally named after it).

### Triage context

- **Kind**: Intent (+ swappable cache provider) · **Native grounding**: HTTP `Cache-Control` / `stale-while-revalidate` (RFC 9111 + 5861); Cache API; `AbortController`
- **Native-first**: ◆ medium (borrow the HTTP cache vocabulary) · **Gap**: ◆ medium · **Effort**: ◆ medium · **Surfaced by**: #1403 (data-lifecycle lens); divergence-pass candidate (#1405); read-path symmetric to #1395

### Recommended path at a glance

Ratify both rows, or override just the one you'd change. **Confidence** says where judgment is actually needed.

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 · home** | mint a first-class **`query` (server-state) intent** over a swappable cache provider | extend `resource-loader`/`loader` with cache traits *(rejected — single-fetch UI ≠ cross-query store)* · a headless `simple-store`-adjacent block | **~85%** — 4 libraries, one model; symmetric to #1395 |
| **1-sub · cache provider** | a **swappable runtime-DI provider behind the contract** (protocol) | bake one cache impl *(rejected — forecloses Cache API / normalized)* | **~85%** — protocol-is-the-only-lock |

## Fork 1 — where does the cross-query cache lifecycle live?

*Fork-existence:* the excluded branch is **"extend `resource-loader`/`loader`,"** and it is **broken** —
those model **one fetch's UI state** (a per-operation version token, a blocking strategy, anti-flicker
timing). A cross-query *shared keyed store* is a different concern (a store, not a fetch); folding it in
would make `loader`'s 7 display states also be a cache registry. This is the same homonym trap #1395 just
untangled on the write side (where `loader.strategy.optimistic` was wrongly hosting the write lifecycle) —
the symmetric mistake here is making the single-fetch orchestrator host the multi-query cache. The branches
cannot coexist (the cache-lifecycle contract lives in exactly one home), so this is a real either/or.

**Fork 1 (a) — mint a first-class `query` (server-state) intent (recommended, ~85%).** Abstract the
cache-lifecycle contract `key → {data, staleness, revalidate}` over a swappable cache provider. Dimensions
borrow platform vocabulary: `fetchPolicy` (cache-first / network-only / cache-and-network), `freshWindow`
(`staleTime`/`max-age`), `evictAfter` (`gcTime`/`keepUnusedDataFor`), `revalidateOn` (focus / reconnect /
interval), `dedupe`, `dependsOn` (dependent-query gating). Symmetric to the mutation lifecycle #1395 (the
write path); a FUI block (`resource-cache` / a `resource-loader` extension) implements it.

**Fork 1 (b) — extend `resource-loader`/`loader` with cache+staleness traits (rejected).** The broken
branch above (conflates single-fetch UI with cross-query cache).

**Fork 1 (c) — a headless `simple-store`-adjacent block (rejected as the *home*).** A block is an impl, not
a contract, and `simple-store` is client state. The cache *provider* may be store-shaped — that's the
sub-fork — but the *contract* is an intent.

*The residual (~15%):* the name (`query` vs `server-state` vs `data-source`) and whether the cache is
distinct enough from `loader` in practice that authors conflate them. Lean **`query`** (symmetric to the
write-path lifecycle, matches `useQuery`); mitigate by having `query` *compose* `loader` for per-entry
display states rather than redefining them.

## Fork 1-sub — is the cache a swappable runtime-DI provider (protocol)?

*Fork-existence:* the excluded branch is **"bake one cache impl,"** and it is **broken** — it would
foreclose delegating to the **Cache API**, an in-memory map, or a normalized entity store (violating
protocol-is-the-only-lock). A genuine protocol-vs-baked call.

**Fork 1-sub (a) — a swappable provider behind a contract (recommended, ~85%).** The `key → {data,
staleness, revalidate}` interface is the lock; the cache impl is DI-injected via the ambient channel
(mirrors `resource-loader`'s Custom Clients + the `CustomStore`/injector pattern).

**Fork 1-sub (b) — bake one cache impl (rejected).** The broken branch above.

*The residual:* whether normalized (entity-level) caching fits the same provider contract or needs its own —
defer; standardize the query-key contract first, normalization as an optional provider capability.

---

### Supported by default (not forks)

- **Read-path symmetric counterpart to #1395 (write path).** They compose — a mutation *invalidates*
  `query` cache entries and optimistically writes a predicted result *into* the cache — completing a clean
  three-way: `loader` (single-fetch *UI*), `query` (cross-query *cache*, reads), and the proposed mutation
  lifecycle (writes). Follow #1395's precedent (a contract-placement decision yielding a new intent + a
  retarget of an existing FUI block, not greenfield).
- **The running cache stays in FUI** (a `resource-cache` block or `resource-loader` extension); WE owns the
  `query` intent + the provider contract (impl-is-not-a-standard).
- **`query` composes `loader`** for per-entry display states; `loader` owns the *display* of staleness,
  `query` owns the *store* of it.
- **Fetch policy is an author-configurable dimension**; most-permissive default **`cache-and-network`** (the
  `stale-while-revalidate` default the platform itself blesses).
- **`prefetch` composes `query`** (eagerness populates cache entries); **dependent queries** = a
  `dependsOn`/`enabled` gate; **normalized/entity caching** = an optional provider capability, not mandated.

### Seams

- **vs `loader`** — single-fetch UI state (blocking, anti-flicker, the *display* of one op's `stale`) vs the
  cross-query cache store; `query` composes `loader`, does not absorb it.
- **vs `resource-loader`** — the single-fetch orchestrator; `query`'s FUI impl extends it or sits beside it.
- **vs `prefetch`** — eagerness populates `query` entries (orthogonal axes).
- **vs #1395 (mutation)** — the write path; invalidates + optimistically writes `query` entries.

### Realizing work (post-ratification, separately prioritized)

If Fork 1 (a) + 1-sub (a) ratify: author the `query` intent JSON (the dimensions above) + the provider
contract + the FUI `resource-cache` block + a demo (keyed cache with staleness + invalidate-on-mutation).
File via `/new-standard`. Not part of this placement call.
