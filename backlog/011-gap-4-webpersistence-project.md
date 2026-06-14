---
type: decision
workItem: story
size: 5
status: resolved
dateOpened: "2026-05-31"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: none
tags: [gap-analysis, project, protocol, persistence, offline]
relatedReport: reports/2026-06-11-webpersistence-project.md
preparedDate: "2026-06-11"
---

# Decide on Persistence/Offline project — `webpersistence` (gap #4)

Completes the data story: `webresources` fetches, `webstates` holds, nothing **persists**. The triage proposed a `webpersistence` project + protocol spanning client storage abstraction, offline-first, optimistic sync, and conflict resolution, anchored on the Storage API, IndexedDB, Cache API, Background Sync, and `navigator.storage.persist()`. No design exists yet — the project-vs-intent shape, the protocol boundary, and which neighbour owns each layer must be ruled on first. The four forks below are grounded in a prior-art survey published as the [Persistence & Offline](/research/web-persistence-offline/) research topic, reconciled with existing change-tracking and reliability work. Each names a recommended default in **bold**.

## Triage context (preserved)

- **Kind**: Project + Protocol
- **Native grounding**: Storage API, IndexedDB, Cache API, Background Sync, `navigator.storage.persist()`
- **Native-first**: ◆ medium · **Gap**: ▲ high · **Effort**: ▲ high
- **Rank**: 4 — soon (the next full project after #3 Theme/Color intent). Recommended as the next project after the Theme/Color intent lands.

## Axis framing

The survey decomposes "persistence" into four orthogonal layers the web platform itself keeps independent, each landing on a different home rather than one new monolith. **Storage abstraction** (durable structured records: IndexedDB + `navigator.storage.persist()`) is genuinely unowned and engine-swappable. **Offline-first** response caching (Cache Storage + Service Worker) is a policy over the *fetcher* — `webresources` territory ([projects.json:22](../src/_data/projects.json#L22)). **Optimistic sync** splits: the *appearance* is already the loader intent's `optimistic` strategy ([intents.json:447](../src/_data/intents.json#L447)), only the durable outbox/replay is new (and Safari lacks Background Sync, so a JS queue is the baseline — reliability's offline-queue territory, [projects.json:159](../src/_data/projects.json#L159)). **Conflict resolution** is the merge over change representations the change-tracking protocol already owns ([protocols.json:53](../src/_data/protocols.json#L53)), grounded in its [change-tracking-observability](/research/change-tracking-observability/) topic ([researchTopics.json:168](../src/_data/researchTopics.json#L168)). The classification rule from [#016](/backlog/016-gap-9-webcommands-project/) applies: a Protocol is earned only where a real multi-vendor engine-swap story exists — which holds for storage, not for the outbox.

### Recommended path at a glance

Ratify all four rows, or override just the one you'd change. The **confidence** column says where judgment is actually needed vs. where to nod.

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 · project vs intent + home** | thin storage **Protocol**, graduated as a facet of `webstates` (no new top-level project) | dedicated `webpersistence` project | **Med** — protocol clear; the owning-home call is the genuine tension |
| **2 · optimistic sync** | optimistic UX stays in loader intent; only the **durable outbox/replay** is new (fixed mechanism) | a new sync intent/protocol *(rejected)* | **High** — loader already owns the UX |
| **3 · conflict resolution** | a **strategy dimension of the existing change-tracking protocol**, gated to sync | a new conflict protocol *(rejected)* | **High** — same axis already mapped |
| **4 · offline cache home** | response cache → **`webresources`**; durable store → **`webstates`** | one `webpersistence` project coordinating all three | **Med** — clean bisection vs. single-owner orchestration |

## Fork 1 — project vs intent, and where storage lives

The durable-structured-storage layer (IndexedDB + `persist()`) is genuinely missing from the constellation and is engine-swappable in the wild — Dexie, RxDB (pluggable `RxStorage` adapters), PouchDB, and TanStack Query's `persistQueryClient` all expose a swappable storage seam behind a stable contract. That is exactly the WE Protocol shape: a `CustomStorageStrategy` registry tried per-scope, IndexedDB the native-first default, `localStorage` the graceful degradation — mirroring the change-tracking protocol's `CustomChangeStrategy` ([protocols.json:53](../src/_data/protocols.json#L53)). So this is **not** an intent (no user-perceivable UX axis); it is a **Protocol**. The real fork is the *owning home*:

- **(A — recommended) A thin storage Protocol graduated as a persistence facet of `webstates`** ([projects.json:58](../src/_data/projects.json#L58)). `webstates` already owns "the data the app holds" (stores, the change-tracking protocol); durable persistence of that state is the same concern extended to disk. No new top-level project; the protocol is small (storage-strategy contract + `persist()`/quota + degradation). Bias toward not minting a project for a thin surface.
- **(B) A dedicated `webpersistence` project.** Justified only if the cross-cutting orchestration across storage + cache + outbox + conflict proves to need a single owner (Fork 4). Heavier; risks straddling `webresources`/`webstates` ownership.
- *Rejected:* a persistence **intent**. There is no user-perceivable, closed-value UX axis here — persistence is infrastructure, not a "what the user experiences" dimension. (Same reasoning that sent #016 to an intent sends *this* away from one.)

## Fork 2 — optimistic sync (the UX is already owned; only the outbox is new)

Optimistic *appearance* — showing a mutation as applied before the server confirms — is already the loader intent's `strategy: optimistic` value ([intents.json:447](../src/_data/intents.json#L447)); TanStack Query's `onMutate`/`onError` snapshot-and-rollback is the canonical implementation of it. Duplicating that as a new intent would be redundant. What is genuinely unowned is the **durable outbox**: persisting pending mutations so they survive a reload and replay on reconnect. Background Sync does this natively but **Safari doesn't support it**, so a JS outbox over IndexedDB is the portable baseline.

- **(recommended)** Optimistic UX stays in the loader intent; the **durable outbox/replay is a fixed mechanism** over the Fork-1 storage protocol plus reliability's existing offline-queue concern ([projects.json:159](../src/_data/projects.json#L159)). It is a deterministic transform with no vendor-interop story → not a protocol, not a new intent.
- *Rejected:* a new "sync intent" or "sync protocol." No swappable-vendor interop for the replay mechanism itself; coining one is lock-in for no gain (the #064 Fork-4 cascade reasoning).

## Fork 3 — conflict resolution (reuse the change-tracking protocol, don't re-own it)

The [change-tracking-observability](/research/change-tracking-observability/) topic ([researchTopics.json:168](../src/_data/researchTopics.json#L168)) already catalogued JSON Patch (RFC 6902), JSON Merge Patch (RFC 7386), CRDTs (Yjs/Automerge), event sourcing, and OT, and produced the change-tracking protocol with a normalized Change Record + `CustomChangeStrategy` registry ([protocols.json:53](../src/_data/protocols.json#L53)). Conflict resolution is the *merge* over exactly those representations — last-write-wins (Firestore), deterministic revision-hash winner (CouchDB/PouchDB), merge-function/CRDT (RxDB — which explicitly warns CRDTs aren't magic), or manual diff-UI (git-style).

- **(recommended)** Conflict resolution is a **strategy dimension of the existing change-tracking protocol**, gated to the replicated/sync case. `webpersistence`/`webstates` references it; it does not redefine it. This is the change-tracking topic's own "pick a preferred strategy, bridge several at once" applied to the sync boundary.
- *Rejected:* a new conflict-resolution protocol. It would re-own the change representations the change-tracking protocol already normalizes — duplication, not interop.

## Fork 4 — offline-cache home (does a `webpersistence` project even straddle two owners?)

Cache Storage + Service Worker is a *fetch* concern (stale-while-revalidate, cache-first, network-first are caching policies over the fetcher — [customizable-fetcher](/research/customizable-fetcher/) under `webresources`, [projects.json:22](../src/_data/projects.json#L22)). The data the app *holds* (IndexedDB records) is a `webstates` concern ([projects.json:58](../src/_data/projects.json#L58)). So gap #4 cleanly bisects.

- **(A — recommended)** **Distribute the layers to their natural owners:** response cache → `webresources`; durable state store → `webstates` (Fork 1); offline-retry queue → `webreliability`; conflict merge → change-tracking protocol (Fork 3). **No new top-level project.** The "persistence project" dissolves into a small protocol on `webstates` + dimensions on existing owners.
- **(B)** A dedicated `webpersistence` project that *coordinates* all four layers under one owner. Defensible only if the cross-cutting sync orchestration (cache invalidation ↔ outbox replay ↔ conflict merge) proves to need a single home rather than living as a thin seam between the existing projects. This is the genuine open tension and the most likely thing to override.

## Open call (preserved)

Confirm scope and shape (project + protocol vs. distributed facets) and timing — recommended as the next project after the Theme/Color intent lands. The load-bearing decision is **Fork 1 + Fork 4 together**: is there a `webpersistence` project at all, or does the gap resolve into a thin storage protocol on `webstates` plus dimensions on `webresources`/`webreliability`/change-tracking?

## Resolution (partial) — 2026-06-11

- **Fork 2 — durable outbox/replay is a fixed mechanism**: optimistic *appearance* already lives in the loader intent's `optimistic` strategy; only persisting pending mutations to survive reload + replay on reconnect is new, and it's a deterministic transform with no swappable-vendor interop story, so it's a fixed mechanism over the storage layer + reliability's offline-queue — not a new intent or protocol.
- **Fork 3 — conflict resolution as a strategy dimension of the change-tracking protocol**: the merge (LWW / revision-hash winner / CRDT / manual diff) operates over exactly the change representations the change-tracking protocol already normalizes, so it's a strategy dimension gated to the sync case rather than a new protocol that would re-own those representations.

**Open — needs a human call:** whether a top-level `webpersistence` project exists at all vs dissolving into facets on `webstates` (durable store), `webresources` (response cache), `webreliability` (offline queue), and change-tracking (conflict merge) — i.e. Fork 1 + Fork 4 together — because this is a net-new project-scope bet (single cross-cutting sync orchestrator vs a thin seam between existing owners) that the per-layer forks deliberately leave for human judgment.

## Resolution (final) — 2026-06-13

**Forks 1 + 4 ratified as Option A — no `webpersistence` project.** Gap #4 dissolves into facets on the existing owners:

- **Storage abstraction** → a **thin storage Protocol graduated as a persistence facet of `webstates`** — a `CustomStorageStrategy` registry tried per-scope, IndexedDB the native-first default, `localStorage` the graceful degradation, plus `navigator.storage.persist()`/quota. Small surface, mirrors the change-tracking protocol's `CustomChangeStrategy`.
- **Response cache** (Cache API + SW policies: stale-while-revalidate / cache-first / network-first) → a dimension of **`webresources`**.
- **Durable outbox/replay** (Fork 2) → a fixed mechanism over the storage protocol + **`webreliability`**'s offline-queue.
- **Conflict merge** (Fork 3) → a strategy dimension of the **change-tracking protocol**, gated to the sync case.

**Why A over B (mint a project):** the only pull toward a top-level project is cross-cutting sync orchestration (cache-invalidation ↔ outbox-replay ↔ conflict-merge), and that orchestration has no concrete consumer yet — B is a speculative bet. A is reversible (the thin protocol can later *graduate* into a project if a real orchestration need appears; un-minting a project is far costlier), and three of the four layers already have unambiguous owners, so wrapping one new thin protocol + three pointers in a project is the over-projectification the constellation bias guards against. Door to B stays open as a graduation path, not a rejection.

**Successor build** (the only net-new artifact): the thin storage protocol on `webstates` → carved as #503. The cache/outbox/conflict facets are dimensions on already-owned surfaces, tracked under their owners' own work.
