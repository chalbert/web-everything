---
kind: decision
size: 3
parent: "099"
status: open
dateOpened: "2026-06-21"
tags: [decision, book-candidate, data-lifecycle, server-state, cache, gap]
---

# Server-state query/cache lifecycle — fetch/dedupe/cache/staleness/invalidate standard: placement

Surfaced by the data-lifecycle lens
([#1403](/backlog/1403-discovery-lens-data-lifecycle-paradigms-load-cache-mutate-sy/)): the **server-state
cache lifecycle** that TanStack Query / SWR / RTK Query / Apollo all converged on — a keyed query cache with
**staleness/TTL**, **in-flight de-dupe**, **invalidate/refresh**, **background-refetch**, and **query
dependency** — has no WE owner. This is the read-path counterpart to optimistic mutation
([#1395](/backlog/1395-optimistic-mutation-apply-reconcile-rollback-standard-placem/)).

WE today owns the **UI state of one fetch**, not the cross-query cache: `loader` (pending-state UX
profiles), `resource-loader` (a single async orchestrator with abort/timing traits), `prefetch`
(eagerness). None models a shared, keyed, staleness-aware cache across queries — the actual library
convergence. A divergence-pass candidate too (#1405): the libraries differ in API but agree on the model,
so it's a strong intent-abstraction target.

**Decision (placement-unsure ⇒ decision):** a `query`/`server-state` intent abstracting the cache-lifecycle
contract (key → {data, staleness, refetch}) over a swappable cache provider **vs** extending `resource-loader`
/ `loader` with cache+staleness traits **vs** a headless `simple-store`-adjacent block. Borrow the
platform-official vocabulary where it exists (HTTP cache-control / stale-while-revalidate). Refs:
[we:src/_data/intents/loader.json](../src/_data/intents/loader.json),
[we:src/_data/blocks/resource-loader.json](../src/_data/blocks/resource-loader.json),
[we:src/_data/intents/prefetch.json](../src/_data/intents/prefetch.json). **Needs `/prepare`.** Unsure ⇒
decision; costs nothing.
