---
kind: story
size: 3
parent: "1399"
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: none
tags: [discovery, lens, data-lifecycle, state, gap, book-candidate]
---

# Discovery lens — data-lifecycle paradigms (load, cache, mutate, sync, conflict)

Run the [discovery](/backlog/1399-latent-standard-discovery-lens-catalogue-each-lens-only-emit/)
discipline against the **server-state lifecycle** surface that data libraries (TanStack Query, RTK Query,
Apollo, SWR, Relay) converged on — a coherent axis distinct from UI components and from local-state stores.
Enumerate the lifecycle verbs and diff against [we:src/_data/intents/](../src/_data/intents/) +
[we:src/_data/blocks/](../src/_data/blocks/); every ❌ / partial → a card (placement-unsure → `decision`).

## Seed verb list (extend during the pass)

fetch + dedupe in-flight · cache + staleness/TTL · background refetch · invalidate / refresh · paginated +
infinite query · optimistic mutation + rollback · query/mutation dependency · prefetch · retry/backoff ·
realtime subscription / live-update · offline queue + sync · conflict resolution (last-write / merge / CRDT).

Cross-check existing owners (`resource-loader`, `prefetch`, `background-task`, `reliability`,
`windowed-collection`, `simple-store`, `broadcast`) — several are partial; note overlap with the
infrastructure lens ([#1402](/backlog/1402-discovery-lens-app-infrastructure-cross-cutting-concerns-inv/))
for optimistic-mutation / offline-sync and de-dupe filings.

## Run 1 — 2026-06-21 (server-state lifecycle verbs)

Diffed each lifecycle verb against [we:src/_data/intents/](../src/_data/intents/) +
[we:src/_data/blocks/](../src/_data/blocks/).

**Covered:**
- paginated + infinite query → `pagination` block + `windowed-collection` + `collection-operations`.
- prefetch → `prefetch` intent + block.
- retry / backoff → `reliability` intent.

**Already filed / routed (no double-file):**
- optimistic mutation + rollback → [#1395](/backlog/1395-optimistic-mutation-apply-reconcile-rollback-standard-placem/) (verb-axis).

**Gaps filed (placement-unsure → decision):**
- **Server-state query/cache lifecycle** (fetch + in-flight dedupe, cache + staleness/TTL, invalidate /
  refresh, background-refetch, query dependency) → [#1419](/backlog/1419-server-state-query-cache-lifecycle-fetch-dedupe-cache-stalen/).
  The TanStack-Query/SWR/RTKQ/Apollo convergence. WE's `loader`/`resource-loader`/`prefetch` cover the UI
  state of ONE fetch, not a keyed cross-query cache — the actual gap.
- **Offline-first sync + realtime / conflict resolution** (offline mutation queue + replay, realtime
  subscription / live-update, last-write/merge/CRDT conflict, presence/collaboration) →
  [#1420](/backlog/1420-offline-first-sync-realtime-conflict-resolution-standard-pla/). The write-path /
  realtime half; absorbs the offline-sync routed from #1402 and the collaboration/presence verb from the
  verb-axis.

**Conclusion:** the data-lifecycle axis is **genuinely under-covered** vs the read-path component axis — WE
owns fetch-UI fragments but not the cache or sync contracts. 2 cards filed (the read-path cache #1419 and the
write/realtime sync #1420), splitting the axis cleanly.

## Done when

Every seeded verb has a verdict and each gap is a filed card or dismissed-with-reason.
**Round 1 complete (2026-06-21) — 2 cards filed (#1419 cache lifecycle, #1420 sync/realtime).**
