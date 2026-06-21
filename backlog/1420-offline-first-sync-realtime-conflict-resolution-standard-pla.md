---
kind: decision
size: 5
parent: "099"
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: none
preparedDate: "2026-06-21"
relatedReport: reports/2026-06-21-offline-sync-realtime-conflict-resolution.md
relatedProject: webrealtime
codifiedIn: docs/agent/platform-decisions.md#composition-artifact-ownership
tags: [decision, book-candidate, data-lifecycle, offline-first, sync, realtime, conflict-resolution, crdt, collaboration, presence, gap]
---

# Offline-first sync + realtime/conflict resolution standard: placement

## ✅ Ruling (ratified 2026-06-21)

**Crux → SPLIT. Fork 1 → (a) no new WE artifact. Fork 2 → (a) presence is its own render intent (moot under 1a).**
Codified in [we:docs/agent/platform-decisions.md#composition-artifact-ownership](/docs/agent/platform-decisions.md#composition-artifact-ownership)
(deferral-bar corollary).

Offline-first sync is a **composition** over four already-ratified orthogonal homes — **webrealtime**
transport, **webreliability** durable outbox/replay, **change-tracking** `CustomChangeStrategy` merge
(LWW default, CRDT opt-in), and the **`mutation`** apply/reconcile/rollback intent — so **no new WE
standard is minted**. The one piece that spans homes — the replay-on-reconnect *choreography* (FIFO +
exactly-once + sync-cursor) — rides a **FUI `sync-coordinator` block** the `draft-persistence` way, not a
fifth standard. **Presence stays its own render intent** (ephemeral / many-at-once / render-shaped;
`CoEditCoordinator` "does not merge state").

**Grounding that decided it (all citations traced to the live tree):** every "already homed" claim
verified — `we:src/_data/protocols/transport-negotiation.json` ("does NOT own any UX render", #455),
`we:src/_data/intents/mutation.json` (apply→reconcile→rollback, pessimistic default, #1395),
`we:src/_data/protocols/change-tracking.json` (CRDT among configurable strategies),
`we:src/_data/intents/reaction.json` ("multi-user sync is a composed webrealtime concern, never baked
in", #370 Fork 5), `we:src/_data/blocks/draft-persistence.json` (`resolveLww` + `CoEditCoordinator`). The
deferral bar in `we:src/_data/protocols/storage.json` (*"graduate … only if a real cross-cutting
sync-orchestration consumer appears"*) is
**unmet**: the flagship exercise-app roadmap (#314/#317 — loan/insurance/healthcare/government/logistics)
holds no collaborative-realtime app. **Confidence ~70%** (raised from the prepared 65% by the roadmap
check + the `draft-persistence` block precedent). **Residual:** if a future app needs cross-cutting
replay, Fork 1(b) becomes right — but the platform's own rule says wait, and the FUI block absorbs it
meanwhile (re-open then). Inline red-team of (a) failed: the choreography is not homeless (it composes
four homes + can live in a block), so (a) violates no principle.

**Follow-up filed:** the optional FUI `sync-coordinator` block (#1478, `locus: frontierui`).

---

**No design is greenfield here — the premise that WE has "no sync/conflict contract" is largely false.**
The write-path/realtime half of the data lifecycle was surfaced as unowned (by the data-lifecycle lens
[#1403](/backlog/1403-discovery-lens-data-lifecycle-paradigms-load-cache-mutate-sy/), routed from the
app-infra lens [#1402](/backlog/1402-discovery-lens-app-infrastructure-cross-cutting-concerns-inv/)
and the verb-axis collaboration line), naming four sub-concerns: **(1)** offline mutation **queue +
replay** on reconnect; **(2)** realtime subscription / **live-update**; **(3)** **conflict resolution**
(LWW / merge / CRDT); **(4)** **presence / collaboration**. But a prior-art survey (published as the
`/research/` topic [offline-sync-realtime-conflict-resolution](/research/offline-sync-realtime-conflict-resolution/),
session report linked via `relatedReport`) found **three of the four already have ratified WE homes**, and
the `storage` protocol summary states the decomposition verbatim. So this is a **contract-placement**
decision over an already-decomposed problem, not a build. The crux fork (single-vs-split) resolves
**decisively to SPLIT**; the genuine open call is narrow.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **Crux** — one `sync` standard, or split? | **SPLIT** — the four sub-concerns are orthogonal axes WE already homes in four ratified places; a single `sync` intent fuses protocol-interop with UX (a category error) | one `sync` intent spanning queue+realtime+conflict *(rejected — broken)* | **~85%** — the whole field factors them apart |
| **Fork 1** — given the split, a thin sync-*orchestration* seam, or **no new WE artifact**? | **(a) No new artifact** — offline-first sync is a *composition* over the existing homes (the #1398 outcome), until `we:src/_data/protocols/storage.json:4`'s "real cross-cutting consumer" bar is met | (b) mint a thin `sync` orchestration intent that composes the four homes + the replay-on-reconnect choreography | **~65%** — the real residual on this card |
| **Fork 2** — *(only if (b))* presence rides the seam, or its own render intent? | **(a) its own presence/roster intent** (bias-to-separation; presence is ephemeral render) | (b) fold presence into the sync seam | **~80%** |

## Axis-framing

The card reads as a homeless-standard placement, but the real tree shows the four sub-concerns are
**already homed** — pinned to disk:

- **Offline queue + replay** — the durable outbox is **webreliability** (*"the durable outbox/replay is
  webreliability"*, we:src/_data/protocols/storage.json:4), and the apply/reconcile/rollback UX is the
  **`mutation` intent** (we:src/_data/intents/mutation.json:6, minted by #1395); the running queue already
  ships as `resource-action`'s `withOptimisticMutation` trait.
- **Realtime transport** — **webrealtime** owns the transport-negotiation protocol
  (we:src/_data/protocols/transport-negotiation.json:4-6: *"CustomTransportProvider … SSE/WebSocket
  native-first … does NOT own any UX render"*; we:src/_data/projects/webrealtime.json:1), ratified
  by-purpose in #455.
- **Conflict resolution** — the **change-tracking** protocol's `CustomChangeStrategy` already makes
  *"snapshot-diff, Proxy, signals, Immer-patch, JSON Patch, and CRDT strategies … configurable and
  interoperable"* (we:src/_data/protocols/change-tracking.json:4); LWW already ships as `resolveLww`
  (we:src/_data/blocks/draft-persistence.json:83). `we:src/_data/protocols/storage.json:4` names it: *"conflict-merge is the
  change-tracking protocol's sync dimension."*
- **Presence / collaboration** — a co-edit presence primitive already ships (`CoEditCoordinator`, *"X also
  editing"* over BroadcastChannel, we:src/_data/blocks/draft-persistence.json:54,88, which *"does not merge
  state"*), and `reaction` already rules *"multi-user sync is a composed webrealtime concern, never baked
  in (#370 Fork 5)"* (we:src/_data/intents/reaction.json:5). The render is a UX intent; the transport is
  webrealtime.

The structural point: these are **four orthogonal axes** (durable outbox · transport · merge-strategy ·
ephemeral presence) that the entire field factors apart (Liveblocks' Presence/Broadcast/Storage/Threads
primitives; PowerSync's upload-queue vs read-stream vs backend-conflict; TanStack's queue-vs-merge;
PartyKit transport-only; CRDT-as-strategy). A single `sync` intent would be the same orthogonality break
#1318/#1324/#1337 found one intent over, and the same protocol↔UX category error the 7-question
classification rules out.

## Fork 1 — given SPLIT, is there a thin sync-orchestration seam worth minting, or no new WE artifact?

**Why it's a fork:** the crux (single-vs-split) is *not itself* a live fork — the single `sync` intent is
**broken** (it fuses four already-homed orthogonal axes; mixes protocol-interop with UX), so SPLIT is a
forced call, recorded in the at-a-glance table and grounded hard against the prior-art finding (every
surveyed system — Liveblocks, PowerSync, TanStack, Replicache, PartyKit, Yjs/Automerge — factors transport
/ queue / merge / presence apart; none ships one fused primitive). The *real* open fork is what remains
**after** the split: the four homes exist, so either offline-first sync is a **pure composition** of them
(no new artifact), or there is a thin **orchestration** concern — the replay-on-reconnect *choreography*
(queue → detect conflict → pick strategy → transport-publish → replay) — that earns its own seam. These
cannot both be the end-state.

- **(a) No new WE artifact — offline-first sync is a composition over the existing homes** *(recommended)*.
  A consuming app declares `mutation` (apply/rollback), wires a `webreliability` durable outbox for the
  queue, picks a `change-tracking` merge strategy for conflicts, and a `webrealtime` transport for
  live-update + presence. This is exactly the [#1398](/backlog/1398-progressive-loading-skeleton-streaming-progressive-hydration/)
  outcome (a surfaced concern that is real but is a composition, not a new standard). It respects
  `we:src/_data/protocols/storage.json:4`'s own bar: *"Can later graduate into a webpersistence project only if a real
  cross-cutting sync-orchestration consumer appears"* — i.e. **don't mint the orchestrator cold; wait for
  the consumer.**
- **(b) Mint a thin `sync` orchestration intent/protocol** *(alternative)*. A seam that *composes* the four
  homes and standardizes only the replay-on-reconnect choreography + the idempotency/checkpoint contract
  that no single existing home owns end-to-end. *Tempting because:* the FIFO-replay + exactly-once +
  sync-cursor choreography genuinely spans webreliability (queue) + mutation (apply) + change-tracking
  (merge) and is re-implemented per app. *Cost:* a fifth home for what may be pure glue; premature per
  `we:src/_data/protocols/storage.json:4`'s bar; risks re-fusing the axes the split just separated.

**Recommended: (a).** *(~65%. Residual: the replay-on-reconnect choreography is the one piece that spans
homes and has no single owner — if an exercise-app collaborative/offline feature actually needs it, (b)
becomes right. Lean (a) until that consumer is real, per the platform's own deferral bar; the choreography
can live in a FUI block (a `sync-coordinator` composing the four contracts) without a new WE standard, the
way `draft-persistence` already composes storage + LWW + presence.)*

## Fork 2 — *(only reached if Fork 1 (b))* does presence/collaboration ride the sync seam, or stay its own render intent?

**Why it's a fork:** presence (who-is-here, live cursors) could be a dimension of the minted sync seam, or
its own intent — they cannot both own the presence render. Bias-to-separation puts the burden on combining,
and the survey shows presence is **structurally unlike** a durable replay queue: it is *ephemeral* (never
persisted), *many-at-once* (peers, not self-over-time), and *render-shaped* (avatars/cursors/roster).
Liveblocks keeps Presence a distinct primitive from Storage for exactly this reason.

- **(a) Presence is its own render intent** *(recommended)*. A presence/roster intent owns the multi-peer
  UX (roster, "X is editing", display limit), composing `webrealtime` for the ephemeral awareness transport
  — mirroring how `reaction` composes webrealtime and how `live-region-status` already announces a *local*
  presence change. Detection/transport stay separate from render (the `CoEditCoordinator` "does not merge
  state" precedent).
- **(b) Fold presence into the sync seam** *(rejected — re-fuses)*. Couples an ephemeral render concern to a
  durable replay-queue orchestrator; re-creates the orthogonality break the split removed.

**Recommended: (a).** *(~80%. Residual: whether the presence *render* is a brand-new intent or an extension
of `live-region-status` / `reaction`'s roster — a naming/scope call, not a fusion question.)*

---

## Supported by default (not decisions)

- **The four sub-concerns keep their ratified homes.** Transport → webrealtime (#455); durable outbox/replay
  → webreliability + the `mutation` apply UX (#1395); conflict-merge → change-tracking's
  `CustomChangeStrategy` (LWW default, CRDT opt-in); presence transport → webrealtime. Ratify the
  composition, don't re-home them.
- **Conflict-merge is already a swappable strategy.** `CustomChangeStrategy` (we:src/_data/protocols/change-tracking.json:4)
  makes LWW / OT / CRDT configurable — *"a conflict-resolution behavior reusable by both"* is already
  realized. Default = **last-write-wins** (the simplest correct default, already `resolveLww`); CRDT is the
  opt-in. The strategy and the transport are the swappable lock-points — **minimize-lock-in win**, not a
  baked "sync engine."
- **Replay choreography is fixed mechanics.** FIFO ordering + idempotent exactly-once replay + a
  checkpoint/sync-cursor are how *any* correct queue behaves (Background Sync API / `SyncManager` is the
  native name) — not author-configurable forks.
- **Composes #1419 (read path).** An offline-replayed write *invalidates / optimistically writes* `query`
  cache entries — the same compose seam #1395 ↔ #1419 already draws (a synced cache).

## Context

**Classification (per-fork 7-question pass, recorded).** **Layer** = *no single layer* — transport =
Protocol (webrealtime), outbox = Protocol (webreliability) + Intent (`mutation`), conflict-merge = Protocol
(change-tracking), presence = Intent (render) + Protocol (transport); a `sync` *intent* spanning all four is
a category error. **Protocol vs dimension** — swappable pieces (transport/merge/storage) = Protocols (the
lock); author-facing pieces (apply strategy, presence render) = Intent dimensions. **Expose the whole axis**
— yes, per existing home (`mutation.strategy`, the change-tracking strategy registry, the transport
preference order are already exposed). **Fixed vs dimension** — conflict-strategy = dimension; FIFO replay +
exactly-once = fixed mechanics. **DI-injectable** — yes, three-fold and already so:
`CustomTransportProvider` + `CustomChangeStrategy` + `CustomStorageStrategy`/`CustomRecoveryHandler`.
**Most-permissive default** — conflict = last-write-wins; apply = pessimistic (inherited from `mutation`).
**Seams** — sync ↔ #1419 `query` cache · ↔ #1395 `mutation` · ↔ change-tracking · ↔ webrealtime · ↔
webreliability · ↔ `broadcast` (we:src/_data/blocks/broadcast.json — cross-context events) · ↔ `reliability`
(we:src/_data/intents/reliability.json:5 — retry/backoff on a failed replay).

**The single-vs-split verdict + its grounding.** SPLIT (~85%). The single `sync` intent is the broken
branch because every leading system factors the problem into separable layers: **Liveblocks** decomposes a
room into distinct primitives (Presence / Broadcast / Storage / Threads); **PowerSync** separates a
persistent upload queue (FIFO + retry + checkpoints) from the read stream and leaves conflict resolution to
the backend; **TanStack Query**'s offline mutation persistence (pause → dehydrate →
`resumePausedMutations()`) is queue+replay and *not* a CRDT model; **Replicache** uses
mutator + push/pull/poke + server-authoritative rebase; **CRDTs (Yjs/Automerge)** are a swappable merge
*algorithm* with idempotent exactly-once replay; **PartyKit** is transport-only. The convergent factoring —
transport / write-outbox / swappable conflict-merge / presence — maps one-to-one onto WE's four ratified
homes. (Full survey: we:reports/2026-06-21-offline-sync-realtime-conflict-resolution.md.)

**Demoted concerns (why not forks).** *"Where does the offline queue live"* — settled (#011/we:src/_data/protocols/storage.json:4:
webreliability). *"Where does realtime transport live"* — settled (#455: webrealtime). *"Is conflict-merge a
reusable behavior"* — settled (change-tracking's `CustomChangeStrategy`, already CRDT-capable). *"Where does
the apply/rollback lifecycle live"* — settled (#1395: the `mutation` intent). Each is *Supported by default*,
not a fork — the platform already ruled.

**Follow-ups to file at resolution.** If Fork 1 (a): record offline-first sync as a composition over
webrealtime + webreliability + change-tracking + mutation (codify the compose recipe in
we:docs/agent/platform-decisions.md, mirroring #1398), and optionally carve a FUI `sync-coordinator` *block*
(not a WE standard) that composes the four contracts — exactly the `draft-persistence` shape. If Fork 1 (b):
spin out the thin `sync` orchestration seam + (Fork 2 (a)) a presence/roster render intent. Lineage carried
in prose (not a `blockedBy` edge): the write-path sibling of #1419's read-path cache, composing #1395's
`mutation` and #455's webrealtime.

**Genuine residual for the skeptic pass.** Fork 1: the replay-on-reconnect *choreography* (FIFO + exactly-once
+ sync-cursor) is the one piece that spans webreliability + mutation + change-tracking and has **no single
owner end-to-end** — if a real exercise-app collaborative/offline feature needs it, the no-new-artifact
default (a) is wrong and (b) becomes right. The recommendation leans (a) per `we:src/_data/protocols/storage.json:4`'s explicit
"wait for a real cross-cutting consumer" bar and the #1398 precedent, but a deciding agent should test that
bar against the actual exercise-app roadmap before ratifying (a). **Needs `/next decision`** to make the call.
