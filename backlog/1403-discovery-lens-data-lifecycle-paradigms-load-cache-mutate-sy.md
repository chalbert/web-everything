---
kind: story
size: 3
parent: "1399"
status: open
dateOpened: "2026-06-21"
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

## Done when

Every seeded verb has a verdict and each gap is a filed card or dismissed-with-reason.
