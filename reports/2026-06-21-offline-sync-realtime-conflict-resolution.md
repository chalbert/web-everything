# Offline-first sync + realtime / conflict-resolution placement survey

Prior-art survey grounding decision [#1420](/backlog/1420-offline-first-sync-realtime-conflict-resolution-standard-pla/)
(surfaced by the data-lifecycle lens [#1403](/backlog/1403-discovery-lens-data-lifecycle-paradigms-load-cache-mutate-sy/),
routed from the app-infra lens [#1402](/backlog/1402-discovery-lens-app-infrastructure-cross-cutting-concerns-inv/)
and the verb-axis collaboration/presence line). Per design-first step 1, prior art is gathered before the
forks are framed so the placement is grounded in how the field actually factors the problem.

## The concern (as filed) and the four sub-concerns

The card asks where the **write-path / realtime** half of the data lifecycle lives, naming four
sub-concerns that "compose but share the *reconcile a local view with an authoritative/peer source over
time* shape":

1. **offline mutation queue + replay** on reconnect (the inverse of the read-path cache #1419);
2. **realtime subscription / live-update** (WebSocket / SSE / push streams updating cached data);
3. **conflict resolution** (last-write-wins / merge / CRDT) when offline edits or concurrent editors collide;
4. **presence / collaboration** (who-else-is-here, live cursors) as the multi-actor extension.

The card frames the crux as: **ONE `sync` intent spanning queue+realtime+conflict** vs **splitting
offline-sync from realtime-collaboration** (different actor models) vs **a conflict-resolution *behavior*
reusable by both**.

## Load-bearing finding 0 — this is NOT greenfield: three of the four sub-concerns already have ratified WE homes

The card's premise ("none owns the sync/conflict contract") is **largely false**. The WE platform has
*already decomposed* this exact problem across four prior rulings, and the `storage` protocol summary
states the decomposition explicitly:

> *"Scope is the durable structured-record store ONLY: the response-cache facet is webresources, **the
> durable outbox/replay is webreliability**, and **conflict-merge is the change-tracking protocol's sync
> dimension** — each tracked under its own owner."*
> — we:src/_data/protocols/storage.json:4 (#011 ratified)

Mapping the four sub-concerns to the tree:

| # | Sub-concern | Already-ruled home | Evidence (real tree) |
|---|---|---|---|
| 1 | offline mutation **queue + replay** | **`webreliability`** (durable outbox/replay) + the **`mutation` intent** owns apply/reconcile/rollback | we:src/_data/protocols/storage.json:4 ("durable outbox/replay is webreliability"); we:src/_data/intents/mutation.json:6; the running queue ships as `resource-action`'s `withOptimisticMutation` (#1395) |
| 2 | realtime subscription / **live-update transport** | **`webrealtime`** — transport-negotiation protocol, ratified by-purpose (#455) | we:src/_data/protocols/transport-negotiation.json:4-6 ("CustomTransportProvider … SSE/WebSocket native-first … does NOT own any UX render"); we:src/_data/projects/webrealtime.json:1 |
| 3 | **conflict resolution** (LWW / merge / CRDT) | **`change-tracking`** protocol — `CustomChangeStrategy`, CRDT is a *configurable strategy* | we:src/_data/protocols/change-tracking.json:4 ("snapshot-diff, Proxy, signals, Immer-patch, JSON Patch, and **CRDT** strategies … configurable and interoperable"); we:src/_data/protocols/storage.json:4 ("conflict-merge is the change-tracking protocol's sync dimension"); LWW already shipping in we:src/_data/blocks/draft-persistence.json:83 (`resolveLww`) |
| 4 | **presence / collaboration** (who-else-is-here) | the **render/UX** is a separate UX intent (live-region-status / a presence intent); the **transport** is `webrealtime`; a co-edit presence primitive already ships | we:src/_data/blocks/draft-persistence.json:6,54,88 (`CoEditCoordinator` "also editing" presence over BroadcastChannel); we:src/_data/intents/reaction.json:5 ("multi-user sync is a **composed webrealtime concern, never baked in**") |

So the question is **not** "where does a homeless sync standard live." It is "should WE mint a *new*
sync-orchestration owner that *composes* these four ratified homes, or is offline-first sync simply the
**composition** of homes that already exist (no new artifact)?" That reframes the crux entirely — and it
is the same reframe #1395 hit ("the premise that WE has no apply-then-reconcile model is false") and #1398
hit (progressive-loading = a composition over existing homes, no new standard).

## Native grounding — borrow the platform vocabulary

- **`navigator.onLine` / `online`/`offline` events** — the connectivity signal a replay queue gates on.
- **IndexedDB + `navigator.storage.persist()`** — the durable outbox store (already the `storage`
  protocol's native-first default; `draft-persistence` uses both).
- **`BroadcastChannel` + the `storage` event** — cross-tab presence/conflict signalling (already used by
  `CoEditCoordinator` in `draft-persistence`).
- **SSE / WebSocket / WebTransport** — realtime transport (already the `transport-negotiation` protocol's
  negotiated channels).
- **Background Sync API (`SyncManager`) / Periodic Background Sync** — the platform's own "retry this write
  when connectivity returns" primitive; the canonical name for replay-on-reconnect.
- Canonical vocabulary to standardize on: *outbox / mutation queue*, *replay on reconnect*, *idempotency
  key* (exactly-once replay), *checkpoint / sync cursor*, *last-write-wins vs merge vs CRDT*, *awareness /
  presence*, *room*, *rebase* (Replicache's server-authoritative re-apply).

## Finding 1 (load-bearing) — leading systems treat offline-sync and realtime-collab as SEPARATE composable layers, not ONE primitive

The card's first key question — do the leading systems treat offline-sync and realtime-collaboration as
ONE primitive or TWO? — the survey answers **decisively: separate, composable layers**, and the
conflict-resolution strategy is itself a *third* swappable thing under both.

- **Liveblocks** — the most complete managed collab platform — internally decomposes a room into **distinct
  primitives: Presence, Broadcast, Storage, Threads** ([Liveblocks concepts](https://liveblocks.io/docs/concepts)).
  Presence (ephemeral who-is-here) is a *different* primitive from Storage (durable shared document) and from
  Broadcast (fire-and-forget events). One product, several primitives — not one fused "sync" knob.
- **PowerSync** factors the write path into a **persistent upload queue with FIFO ordering + retries +
  checkpoints**, *separate* from the read sync-stream, and **leaves conflict resolution to your backend**
  ([PowerSync write patterns](https://queryplane.com/docs/blog/write-patterns-for-powersync)). Queue ≠
  stream ≠ conflict policy.
- **TanStack Query** ships **offline mutation persistence** — paused mutations dehydrated to a persister,
  `resumePausedMutations()` on reconnect ([Network Mode](https://tanstack.com/query/v4/docs/framework/react/guides/network-mode),
  [Mutations](https://tanstack.com/query/v4/docs/react/guides/mutations)) — and this is **not a CRDT model
  at all**; it is queue + replay layered on the same `useMutation` lifecycle. The write-queue and the
  conflict-merge are orthogonal.
- **Replicache** uses a **mutator + push/pull/poke + server-authoritative rebase** model — the conflict
  story is "rebase against the canonical server," distinct from CRDT merge
  ([ElectricSQL vs PowerSync vs Replicache](https://queryplane.com/blog/electricsql-vs-powersync-vs-replicache/)).
- **CRDTs (Yjs / Automerge)** are a **conflict-merge *algorithm*** you plug in — Automerge "queues your
  changes locally, syncs when you reconnect" with **idempotent (exactly-once) delivery**
  ([Yjs vs Automerge vs Loro](https://www.pkgpulse.com/guides/yjs-vs-automerge-vs-loro-crdt-libraries-2026),
  [Automerge + Convex](https://stack.convex.dev/automerge-and-convex)). The merge strategy is swappable;
  the offline-queue + transport around it is the same regardless of whether merge is LWW, OT, or CRDT.
- **PartyKit** is explicitly *transport only* — "doesn't include built-in CRDT infrastructure — you'd
  integrate Yjs yourself"
  ([Liveblocks vs PartyKit vs Hocuspocus](https://www.pkgpulse.com/guides/liveblocks-vs-partykit-vs-hocuspocus-realtime-2026)).
  Transport and conflict-merge are cleanly separable in the field's own architecture.

**The convergent factoring:** the field does *not* sell "one sync primitive." It sells **(a) a transport**
(WS/SSE), **(b) a write outbox/queue with replay**, **(c) a swappable conflict-merge strategy** (LWW / OT
/ CRDT), and **(d) presence/awareness** as a distinct ephemeral channel. This maps **one-to-one** onto
WE's already-ratified homes (transport-negotiation / webreliability outbox + mutation / change-tracking /
presence-UX + webrealtime). The survey **reshapes the crux**: the single `sync` intent is the *broken*
branch (it fuses four orthogonal, already-homed axes), and "a conflict-resolution behavior reusable by
both" is **already true** (`change-tracking`'s `CustomChangeStrategy`).

## Finding 2 — the two actor models ARE genuinely different end-states, but the split is along EXISTING seams

The card's hypothesis (offline-sync = self-over-time; realtime-collab = many-at-once → split) holds, but
the survey shows the cut is *finer* than a two-way split:

- **self-over-time (offline-first)** = durable outbox (webreliability) + a checkpoint/cursor + replay on
  `online` + the `mutation` apply/rollback lifecycle. No peer. Conflict is "my offline edits vs the server
  that moved on" → server-authoritative rebase or LWW.
- **many-at-once (realtime-collab)** = a live transport (webrealtime) + a shared document with a
  *concurrent* merge strategy (change-tracking CRDT/OT) + **presence** (ephemeral, never persisted).

These share the **conflict-merge strategy contract** (change-tracking) and the **transport** (webrealtime)
but differ in actor model. Crucially, *neither needs a new owner* — both decompose onto existing seams.
Fusing them into one `sync` intent would force a single artifact to span an ephemeral presence channel, a
durable outbox, a transport negotiation, and a merge algorithm — four axes WE deliberately keeps in four
homes (the same orthogonality break #1318/#1324/#1337 found one intent over, and the same homonym trap
#1395 untangled on `loader.strategy.optimistic`).

## Finding 3 — presence/collaboration UX is a thin render intent; the primitive partly already ships

"Who-else-is-here / live cursors" splits into **transport** (webrealtime, ephemeral awareness messages),
**presence state** (a roster of peers), and **render** (avatars / cursors / "X is editing"). The render is
a UX intent (live-region-status already announces a *local* presence change; a dedicated presence/roster
intent could own the multi-peer roster UX). The **co-edit presence primitive already exists**:
`CoEditCoordinator` (we:src/_data/blocks/draft-persistence.json:54,88) surfaces "X also editing" over
BroadcastChannel **and explicitly "does not merge state"** — detection and policy are already separated.
And `reaction` (we:src/_data/intents/reaction.json:5) already rules that *"multi-user sync is a composed
webrealtime concern, never baked in (#370 Fork 5)."* WE has a **standing precedent** that collaboration
sync is composed, never owned by the consumer.

## Finding 4 — WE precedent is unanimous: compose existing homes, mint only the thin missing seam

- **#455** (ratified) — realtime transport homed *by purpose* in `webrealtime`; transport ≠ render.
- **#011** (ratified) — storage facet decomposed; **outbox/replay → webreliability, conflict-merge →
  change-tracking** named explicitly.
- **#1395** (resolved) — write-lifecycle `mutation` intent minted; the running queue stays in
  `resource-action` (FUI); reversibility shares `change-record`.
- **#1419** (prepared) — read-path `query` cache; a mutation *invalidates / optimistically writes* cache
  entries — the compose seam to the write path.
- **#1398** (resolved) — progressive-loading was ruled a **composition over existing homes, no new
  standard**. The precedent for "this surfaced concern is real but needs no new artifact."

The unanimous move: **name the orthogonal axis in its own home; compose, don't fuse.** Applied here, the
four sub-concerns are *already* in four homes, so the only thing that could be new is a **thin
orchestration seam** that *sequences* them (queue → detect conflict → pick strategy → transport-publish →
replay) — and even that is a question of whether such a cross-cutting orchestrator earns its keep, exactly
the bar we:src/_data/protocols/storage.json:4 sets: *"Can later graduate into a webpersistence project only if a real
cross-cutting sync-orchestration consumer appears."*

## Classification (per-fork 7-question pass, recorded)

1. **Layer** — there is **no single layer**: transport = Protocol (webrealtime), outbox/replay = Protocol
   (webreliability) + Intent (`mutation` for the apply UX), conflict-merge = Protocol (change-tracking),
   presence = Intent (render UX) + Protocol (transport). A `sync` *intent* spanning all four is a category
   error (mixes protocol interop with UX).
2. **Protocol vs intent dimension** — the swappable pieces (transport, merge-strategy, storage) are
   **Protocols** (engine-swap/interop = the lock); the author-facing pieces (apply strategy, presence
   render) are **Intent dimensions**. They are not one thing.
3. **Expose the whole axis** — yes, *per existing home*: `mutation.strategy`, `change-tracking` strategy
   registry, `transport-negotiation` preference order are all already exposed as axes.
4. **Fixed mechanic vs dimension** — conflict-strategy = **dimension** (LWW/merge/CRDT all legitimate);
   replay-on-reconnect ordering (FIFO) + idempotent exactly-once = **fixed mechanics** of any correct queue.
5. **DI-injectable** — yes, three-fold and already so: `CustomTransportProvider`, `CustomChangeStrategy`,
   `CustomStorageStrategy`/`CustomRecoveryHandler` are all swappable DI providers. **This is the
   minimize-lock-in win** — the merge strategy and transport are the swappable lock-points, not a baked
   "sync engine."
6. **Most-permissive default** — conflict default = **last-write-wins** (the simplest correct default,
   already `draft-persistence`'s `resolveLww`); CRDT is the opt-in. Apply default = **pessimistic**
   (inherited from `mutation`).
7. **Seams** — `sync` ↔ #1419 `query` cache (replay writes invalidate/optimistically-write entries) · ↔
   #1395 `mutation` (offline replay *is* the queued mutation apply/rollback) · ↔ `change-tracking`
   (conflict-merge strategy) · ↔ `webrealtime` (transport for live-update + presence) · ↔ `webreliability`
   (durable outbox/replay) · ↔ `broadcast` (cross-tab/cross-context events) · ↔ `reliability` (retry/backoff
   on a failed replay).

## The prepared verdict

**Crux (single-vs-split) → SPLIT, decisively (~85%).** The single `sync` intent is the **broken** branch:
it fuses four orthogonal axes (durable outbox, transport, conflict-merge, presence) that WE already homes
in four ratified places, and that the entire field (Liveblocks primitives, PowerSync layers, TanStack
queue-vs-merge, PartyKit transport-only, CRDT-as-strategy) factors apart. The "conflict-resolution behavior
reusable by both" sub-option is **already realized** as `change-tracking`'s `CustomChangeStrategy`. So the
genuine remaining call is narrow: **is there a thin sync-*orchestration* seam worth minting** (an intent
that *composes* the four homes and adds only the offline replay-on-reconnect choreography), or is
offline-first sync a pure composition with **no new WE artifact** (the #1398 outcome)? That is Fork 1
below. Fork 2 settles, *if* a new seam is minted, whether presence/collaboration rides it or stays its own
render intent.

See the backlog item for the full fork shape; this report is the grounding artifact.

Sources:
- [ElectricSQL vs PowerSync vs Replicache — QueryPlane](https://queryplane.com/blog/electricsql-vs-powersync-vs-replicache/)
- [PowerSync Write Patterns — QueryPlane](https://queryplane.com/docs/blog/write-patterns-for-powersync)
- [TanStack Query — Network Mode](https://tanstack.com/query/v4/docs/framework/react/guides/network-mode)
- [TanStack Query — Mutations](https://tanstack.com/query/v4/docs/react/guides/mutations)
- [Liveblocks — Concepts](https://liveblocks.io/docs/concepts)
- [Liveblocks vs PartyKit vs Hocuspocus — PkgPulse](https://www.pkgpulse.com/guides/liveblocks-vs-partykit-vs-hocuspocus-realtime-2026)
- [Yjs vs Automerge vs Loro — PkgPulse](https://www.pkgpulse.com/guides/yjs-vs-automerge-vs-loro-crdt-libraries-2026)
- [Going local-first with Automerge and Convex — Convex](https://stack.convex.dev/automerge-and-convex)
- [OT vs CRDT in 2026 — Taskade](https://www.taskade.com/blog/ot-vs-crdt)
