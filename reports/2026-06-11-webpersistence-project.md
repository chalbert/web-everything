# Persistence / offline / sync — prior-art survey (`webpersistence`, gap #4)

**Date**: 2026-06-11
**Point**: Web-platform and library prior art for the client-side persistence story — storage abstraction, offline-first, optimistic sync, conflict resolution — grounding backlog #011's open forks (is `webpersistence` a project + protocol or an intent, and what is its scope). Decomposes the gap into orthogonal axes and reconciles it with the existing `change-tracking-observability` topic under `webstates` and the `error-recovery-patterns` topic under `webreliability`.
**Backlog item**: `/backlog/011-gap-4-webpersistence-project/`
---

## Question

Gap #4 of the standards gap-analysis: `webresources` fetches data and `webstates` holds it in memory, but **nothing durably persists** it across reloads, sessions, or network loss. The triage proposed a `webpersistence` **project + protocol** covering "client storage abstraction, offline-first, optimistic sync, conflict resolution," anchored on Storage API / IndexedDB / Cache API / Background Sync. Before authoring anything, survey prior art so the boundary against the *already-owned* neighbours (loader's `optimistic` strategy, the change-tracking protocol's CRDT/JSON-Patch model, reliability's offline-queue) is drawn deliberately rather than by accident, and so the project-vs-intent call is made on the per-fork classification rule (a Protocol earns the name only where there is a real multi-vendor interop / engine-swap story).

## Key findings

### 1. The web platform separates persistence into FOUR independent layers — they are not one concern

No single native API spans "the persistence story." The platform offers four primitives that compose but stay orthogonal, and every survey and library keeps them apart:

- **Durable structured storage** — IndexedDB is the queryable NoSQL store for application data; `navigator.storage.persist()` requests *durability* (without it the browser may silently evict under storage pressure, and Safari/ITP resets unvisited-origin IndexedDB after 7 days), and `navigator.storage.estimate()` reports the shared quota ([web.dev offline-data](https://web.dev/learn/pwa/offline-data), [LogRocket 2025](https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/)). This is the **storage-abstraction** axis.
- **HTTP-response caching** — the Cache Storage API stores `Request`→`Response` pairs, almost always driven by a **Service Worker** that intercepts `fetch`. Distinct quota concern, distinct data shape (responses, not records) ([dev.to: Cache vs IndexedDB](https://dev.to/mino/browser-storage-deep-dive-cache-vs-indexeddb-for-scalable-pwas-35f4)). This is the **offline-first** axis — and it overlaps `webresources` (it caches *fetches*), not in-memory state.
- **Deferred replay** — Background Sync lets a Service Worker queue user actions while offline and replay them on reconnect without the tab open; **Safari does not support it**, so a JS-level outbox queue is the portable fallback ([Microsoft Edge PWA docs](https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/how-to/offline)). This is the **optimistic-sync / outbox** axis.
- **Cross-tab coordination** — the Web Locks API (`navigator.locks.request`) serialises writes across tabs sharing one origin's IndexedDB, the standard guard against two tabs corrupting the same store. A cross-cutting concern, not a layer of its own.

**Implication (fork 1):** "persistence" is not one thing. The durable-storage layer is genuinely missing from the constellation; the offline-cache layer arguably belongs to `webresources`; the sync/conflict layer overlaps `change-tracking`. The project's real *new* surface is narrower than the triage's four-bullet scope.

### 2. There IS a multi-vendor interop story for storage — so a Protocol is earned (grounds fork 1)

Unlike gap #9 (keybindings, which resolved to an intent because no engine-swap story existed — [#016](../backlog/016-gap-9-webcommands-project.md)), client storage has a real, divergent vendor landscape that apps want to swap between behind a stable contract:

- **Dexie.js** — thinnest IndexedDB wrapper; the default for structured local storage.
- **RxDB** — reactive, pluggable `RxStorage` adapters (Dexie, IndexedDB, OPFS-SQLite, memory), CRDT conflict handling, replication to any backend ([RxDB storage](https://rxdb.info/rx-storage-dexie.html), [RxDB CRDT](https://rxdb.info/crdt.html)).
- **PouchDB** — CouchDB-protocol replication, deterministic revision-hash conflict winner.
- **TanStack Query** `persistQueryClient` — persists the *query/mutation cache* (not a DB) to any sync/async storage persister, with paused-mutation dehydrate/hydrate for offline ([TanStack persistQueryClient](https://tanstack.com/query/v4/docs/framework/react/plugins/persistQueryClient)).

RxDB's own pluggable-`RxStorage` design is the proof: a `CustomStorageStrategy` registry tried per-scope, with IndexedDB the native-first default and Dexie/RxDB/OPFS as opt-in adapters, is exactly the WE protocol shape (cf. the change-tracking protocol's `CustomChangeStrategy`, [protocols.json:53](../src/_data/protocols.json#L53)). **Verdict for fork 1:** storage is a **Protocol** (engine-swappable, graceful degradation to `localStorage`), owned by a project — not merely an intent. The project, though, is thin: it may be a **persistence facet of `webstates`** rather than a new top-level `webpersistence`.

### 3. Optimistic UX is ALREADY owned — the new piece is the outbox queue, not the indicator (grounds fork 2)

The loader intent already carries `strategy: optimistic` ([intents.json:447](../src/_data/intents.json#L447)) — the *UX* of showing a mutation as applied before the server confirms. TanStack Query's `onMutate`/`onError` snapshot-and-rollback is the canonical pattern: cancel refetches, snapshot previous, roll back on failure ([TanStack optimistic updates](https://tanstack.com/query/v4/docs/react/guides/optimistic-updates)). What is *not* owned anywhere is the **durable outbox**: persisting pending mutations so they survive a reload and replay on reconnect (TanStack's paused-mutation dehydrate/hydrate; Background Sync's queue). 

**Implication (fork 2):** optimistic *appearance* is a loader-intent dimension (don't duplicate it). The new surface is the **replay/outbox mechanism** — a deterministic transform with no vendor-interop story (a JS outbox over IndexedDB is the portable baseline because Safari lacks Background Sync). That makes it a **fixed mechanism / config**, not a protocol and not a UX intent — it rides the storage protocol plus reliability's existing offline-queue concern ([error-recovery-patterns](../src/_data/researchTopics.json), webreliability — [projects.json:159](../src/_data/projects.json#L159)).

### 4. Conflict resolution is the SAME axis the change-tracking topic already mapped — do not re-own it (grounds fork 3)

The `change-tracking-observability` topic ([researchTopics.json:168](../src/_data/researchTopics.json#L168)) already catalogued JSON Patch (RFC 6902), JSON Merge Patch (RFC 7386), CRDTs (Yjs/Automerge), event sourcing, and OT, and produced the **change-tracking protocol** ([protocols.json:53](../src/_data/protocols.json#L53)) with a normalized Change Record and a `CustomChangeStrategy` registry. Conflict resolution is the *merge* operation over exactly those change representations:

- **Last-write-wins** (Firestore, Dexie Cloud default) — simple, silently drops the loser.
- **Deterministic revision-hash winner** (CouchDB/PouchDB) — picks one side, keeps the other retrievable.
- **Merge function / CRDT** (RxDB, Automerge, Yjs) — auto-merges; RxDB explicitly warns CRDTs are *not* magic ("basically the same complexity as implementing conflict resolution strategies" — [RxDB local-first](https://rxdb.info/articles/local-first-future.html)).
- **Manual / diff-UI** (git-style) — surface the conflict to the user.

**Verdict for fork 3:** conflict resolution is a **strategy dimension of the existing change-tracking protocol**, gated to the replicated/sync case — *not* a new conflict protocol. `webpersistence` references it; it does not redefine it. This is the change-tracking topic's own "interop/configuration layer that lets one app pick a preferred strategy and bridge several" applied to the sync boundary.

### 5. Offline-cache of fetches leans toward `webresources`, not a new home (grounds fork 4)

Cache Storage + Service Worker is fundamentally a *fetch* concern: stale-while-revalidate, cache-first, network-first are caching policies over `webresources`' fetcher ([customizable-fetcher](../src/_data/researchTopics.json) under webresources, [projects.json:22](../src/_data/projects.json#L22)). The data the app *holds* (IndexedDB records) is a `webstates` concern. So the gap #4 "client storage abstraction" cleanly bisects: **response cache → webresources**, **durable state store → webstates**. A standalone `webpersistence` project would straddle both and duplicate their fetch/state ownership.

**Implication (fork 4):** the leanest shape is **no new top-level project** — graduate a *persistence protocol* into `webstates` (durable store) and a *caching policy* dimension into `webresources` (response cache), with reliability owning the offline-retry queue. The alternative (a dedicated `webpersistence` project that *coordinates* the three) is defensible only if the cross-cutting sync orchestration proves to need a single owner.

### 6. There is no "native persistence framework" — the baseline is hand-assembled

The platform gives primitives (IndexedDB, Cache, Locks, persist, Background Sync) but **no orchestration layer**: no native outbox, no native conflict merge, no native store abstraction. Every offline-first app assembles these by hand or adopts RxDB/Dexie/PouchDB. So WE's native-first baseline is "IndexedDB + `persist()` + a JS outbox," and the libraries are registered adapters — the standard's value is the *contract* over the primitives, not new runtime.

## Recommendation (forks for #011)

1. **Persistence storage is a Protocol, not just an intent** (CustomStorageStrategy, IndexedDB-default, Dexie/RxDB adapters) — but it is thin, and the open call is whether it warrants a *new* `webpersistence` project or graduates into `webstates`. Recommend **facet of `webstates`** unless cross-cutting sync orchestration demands a dedicated owner.
2. **Optimistic UX stays in the loader intent; only the durable outbox/replay is new** — a fixed mechanism over the storage protocol + reliability's offline queue, not a protocol, not a duplicate intent.
3. **Conflict resolution = a strategy dimension of the existing change-tracking protocol**, gated to sync; do not coin a new conflict protocol.
4. **Offline response-cache leans to `webresources`; durable state store leans to `webstates`** — default to no new top-level project, distributing the three layers to their natural owners.

## Cross-references

- Decision: [#011 — Persistence/Offline project `webpersistence` (gap #4)](../backlog/011-gap-4-webpersistence-project.md)
- Reconciles: [change-tracking-observability](../src/_data/researchTopics.json) topic + [change-tracking protocol](../src/_data/protocols.json) (webstates) · [error-recovery-patterns](../src/_data/researchTopics.json) (webreliability) · [customizable-fetcher](../src/_data/researchTopics.json) (webresources)
- Neighbours: [Loader Intent `optimistic`](../src/_data/intents.json) · [Reliability Intent](../src/_data/intents.json) · projects [webresources](../src/_data/projects.json) · [webstates](../src/_data/projects.json) · [webreliability](../src/_data/projects.json)
- Precedent for project-vs-intent classification: [#016 — webcommands → intent, not project](../backlog/016-gap-9-webcommands-project.md)

## Sources

- [Offline-first frontend apps in 2025: IndexedDB and SQLite — LogRocket](https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/)
- [Offline data — web.dev](https://web.dev/learn/pwa/offline-data)
- [Store data on the device — Microsoft Edge PWA docs](https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/how-to/offline)
- [Browser Storage Deep Dive: Cache vs IndexedDB — dev.to](https://dev.to/mino/browser-storage-deep-dive-cache-vs-indexeddb-for-scalable-pwas-35f4)
- [RxDB rx-storage adapters](https://rxdb.info/rx-storage-dexie.html) · [RxDB CRDT](https://rxdb.info/crdt.html) · [RxDB local-first future](https://rxdb.info/articles/local-first-future.html)
- [TanStack Query optimistic updates](https://tanstack.com/query/v4/docs/react/guides/optimistic-updates) · [persistQueryClient](https://tanstack.com/query/v4/docs/framework/react/plugins/persistQueryClient)
