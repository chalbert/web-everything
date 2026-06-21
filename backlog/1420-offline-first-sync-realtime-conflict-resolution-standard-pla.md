---
kind: decision
size: 5
parent: "099"
status: open
dateOpened: "2026-06-21"
tags: [decision, book-candidate, data-lifecycle, sync, realtime, collaboration, gap]
---

# Offline-first sync + realtime/conflict resolution standard: placement

Surfaced by the data-lifecycle lens
([#1403](/backlog/1403-discovery-lens-data-lifecycle-paradigms-load-cache-mutate-sy/)) and routed here from
the app-infra lens ([#1402](/backlog/1402-discovery-lens-app-infrastructure-cross-cutting-concerns-inv/),
offline/sync) and the verb-axis (collaboration/presence/multiplayer): the **write-path / realtime** half of
the data lifecycle has no WE owner —
- **offline mutation queue + replay** on reconnect (the inverse of the read-path cache,
  [#1419](/backlog/1419-server-state-query-cache-lifecycle-fetch-dedupe-cache-stalen/));
- **realtime subscription / live-update** (WebSocket / SSE / push streams updating cached data);
- **conflict resolution** (last-write-wins / merge / CRDT) when offline edits or concurrent editors collide;
- **presence / collaboration** (who-else-is-here, live cursors) as the multi-actor extension.

These compose but share the "reconcile a local view with an authoritative/peer source over time" shape.
WE's `reliability` (retry/backoff), `broadcast` (cross-context events), and optimistic mutation
([#1395](/backlog/1395-optimistic-mutation-apply-reconcile-rollback-standard-placem/)) touch fragments;
none owns the sync/conflict contract.

**Decision (placement-unsure ⇒ decision):** ONE `sync` intent spanning queue+realtime+conflict **vs**
splitting offline-sync from realtime-collaboration (different actor models: self-over-time vs many-at-once)
**vs** a conflict-resolution behavior reusable by both. Likely interacts with #1419 (a synced cache) and
#1395 (optimistic apply). Refs:
[we:src/_data/intents/reliability.json](../src/_data/intents/reliability.json),
[we:src/_data/blocks/broadcast.json](../src/_data/blocks/broadcast.json). **Needs `/prepare`** — the
single-vs-split fork is the crux. Unsure ⇒ decision; costs nothing.
