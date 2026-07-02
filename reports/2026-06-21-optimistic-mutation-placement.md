# Optimistic mutation — apply / reconcile / rollback: placement (prep for #1395)

> Prior-art survey + grounding for the decision [#1395](/backlog/1395-optimistic-mutation-apply-reconcile-rollback-standard-placem/).
> Published as the `/research/` topic `optimistic-mutation-lifecycle`. Companion to the undo/redo
> placement decision [#1394](/backlog/1394-undo-redo-reversible-mutation-history-standard-placement/) —
> the two share a reversibility primitive (below).

## Headline — the premise is wrong; the model already exists

The card was filed (verb-axis lens #1390, data-lifecycle lens #1403) on the claim that "WE owns loading,
reliability, background-task, but **no** apply-then-reconcile-then-rollback model." Tracing the tree, that
is **false**. WE already ships the optimistic-mutation lifecycle as the **`resource-action` block** (status
`draft`, `implementsIntent: action`, `dependsOn: resource-loader`):

- `we:src/_data/blocks/resource-action.json:6` — summary: *"Manages async mutation lifecycle (POST/PUT/DELETE)
  — busy state on triggers, double-submit prevention, **optimistic updates with automatic rollback on error**."*
- `withOptimisticMutation` trait (`we:resource-action.json:153`): *"Applies predicted result immediately, reverts
  on error."*
- A dedicated rollback event: `resource-action-revert` (`we:resource-action.json:78`) — *"Fired when an
  optimistic update is rolled back due to error"*, carrying `previousState` (the snapshot restored on revert).
- `designDecisions.optimisticRevert` (`we:resource-action.json:101`): *"Optimistic updates are automatically
  reverted on error."*
- `frameworkComparison` already maps the industry model: TanStack `useMutation` (`onMutate` optimistic /
  `onError` rollback / `invalidateQueries`), Apollo `optimisticResponse` + cache `update`, SWR
  `useSWRMutation`, Remix `<Form>`/action functions (`we:resource-action.json:110-145`).

So this is **not** a greenfield build. It is a **contract-placement** call: the lifecycle is *implemented*
but **unnamed at the intent layer**, and its rollback half overlaps machinery WE already has.

## Two grounding gaps the placement must close

### 1. The mutation lifecycle has no owning intent — it squats on the loader's

`resource-action` declares `implementsIntent: action`, but the `action` intent
(`we:src/_data/intents/action.json`) is purely **visual-weight**: its dimensions are `level` / `variant` /
`disposition` / `busy` / `groupOrdering` / `groupSizing`. Nothing about apply / reconcile / rollback. The
`command` intent's own summary states the boundary explicitly: *"Orthogonal to the Action Intent (visual
weight)"* (`we:src/_data/intents/command.json`). So the lifecycle contract `resource-action` actually
delivers is **not represented by any intent it claims**.

Worse, the `withOptimisticMutation` trait wires its `intentDimension` to **`loader.strategy.optimistic`**
(`we:resource-action.json:155`). But `loader.strategy` (`we:src/_data/intents/loader.json`) is *"how the UI is
blocked during a pending state"* — a **read/blocking** dimension whose values (`optimistic` / `soft` / `hard`
/ `replacement`) describe loader UX, not write-rollback. The mutation trait is borrowing a read-side
dimension because no write-side axis exists. This is a real seam gap: the mutation-lifecycle axis needs a
home.

`resource-loader` itself also carries a read-side `withOptimistic` trait (`we:resource-loader.json:203`,
`loader.strategy.optimistic`) — distinct concern (optimistic *load* prediction), but it shows the same
"optimistic" word doing two jobs under one dimension.

### 2. The rollback primitive already exists — `change-record` — and undo/redo needs the same one

The `change-record` semantic (`we:src/_data/semantics/change-record.json`) defines the normalized mutation
record: `path` (RFC 6901), `op` (RFC 6902), `oldValue` / `newValue`, `source`, `timestamp`, `version`. The
definition's own note is the key: *"`oldValue` is carried because RFC 6902 ops are **not self-inverting**."*
That `oldValue` is exactly **what an optimistic revert restores**, and the inverse-op it enables is exactly
**what undo/redo applies**. The semantic is a *"provisional interop target (research topic
`change-tracking-observability`); shape to be finalized in the **Change Tracking protocol**."*

So the reversibility machinery optimistic-mutation needs is the *same* machinery undo/redo (#1394) needs,
and it already has a designated home (the change-record semantic → Change Tracking protocol). Both #1395 and
#1394 flag "shared rollback machinery" — this is where it lives.

Other blocks duplicate the optimistic pattern locally, reinforcing that the contract is real and recurring:
- `reaction` block (`we:src/_data/blocks/reaction.json`) — adopts Atlassian's `optimisticallyUpdated` flag in
  its ReactionSummary contract.
- `reorderable-list` block (`we:src/_data/blocks/reorderable-list.json`) — a *"pluggable commit strategy"*
  (optimistic reorder, revert on rejected commit).

## Prior-art survey — the apply→reconcile→rollback model the field converged on

Every server-state library ships the same three-phase lifecycle, distinct from the query/read lifecycle:

| Library | Apply (optimistic) | Reconcile (settle) | Rollback (on error) |
|---|---|---|---|
| **TanStack Query** `useMutation` | `onMutate` (cancel in-flight, snapshot, set predicted) | `onSettled` → `invalidateQueries` | `onError(err, vars, context)` restore snapshot |
| **Apollo Client** `useMutation` | `optimisticResponse` | cache `update` / refetchQueries | automatic cache rewrite on error |
| **SWR** `useSWRMutation` / `mutate` | `optimisticData` | `populateCache` + `revalidate` | `rollbackOnError` |
| **RTK Query** | `onQueryStarted` + `updateQueryData` (`patchResult`) | invalidatesTags | `patchResult.undo()` |
| **Relay** | `optimisticResponse` / `optimisticUpdater` | store commit | discard optimistic update on error |

Convergent shape: **(1)** snapshot the current state, **(2)** apply a *predicted* result immediately,
**(3)** fire the mutation, **(4)** on success reconcile/invalidate against the source of truth, **(5)** on
failure restore the snapshot. Cross-cutting concerns every one also handles: **double-submit prevention**
(disable trigger while pending), **busy state** on the trigger, and **cache invalidation** of dependent
queries. `resource-action` already mirrors this exactly — it is WE's `useMutation`.

The read/write split is itself a near-universal library decision (TanStack `useQuery` vs `useMutation`; SWR
`useSWR` vs `useSWRMutation`; Apollo `useQuery` vs `useMutation`). WE already draws it: `resource-loader`
(reads) vs `resource-action` (writes), with `resource-action.designDecisions.mutationVsQuery` citing the
same rationale.

## Per-fork classification (the 7-question pass)

1. **Layer** — the lifecycle axis is an **Intent** (declarative "what" the write UX does); the running
   implementation is a **Block** (`resource-action`, FUI). The reversibility primitive is a **Semantic →
   Protocol** (`change-record` → Change Tracking).
2. **Protocol or intent dimension?** The *mutation UX* axis is an **intent dimension** (no swappable-vendor
   interop story of its own). The *reversibility record* genuinely needs cross-strategy interop (snapshot vs
   JSON-Patch vs CRDT all map into it) → that half is the **Change Tracking protocol**, not a mutation-intent
   concern.
3. **Expose the whole axis?** Yes — optimistic-vs-pessimistic is author-configurable; surface the strategy as
   a dimension, not a baked behavior.
4. **Fixed mechanic or dimension?** *Strategy* (optimistic / pessimistic) = **dimension** (both legit
   end-states). *Rollback-on-error within optimistic* = **fixed mechanic** (an optimistic apply with no revert
   path is broken). *Double-submit prevention* = fixed mechanic.
5. **DI-injectable?** Reconcile/transport already goes through Custom Clients (DI); the rollback/commit
   strategy is a behavioral dimension resolvable via the ambient channel, not hardcoded on the block.
6. **Most-permissive default?** Strategy default = **pessimistic** (await the server, then apply) — the
   simplest correct behavior; optimistic is the author's opt-in (it requires a *predicted* result the author
   supplies). (Note: "most-permissive" here = the default that's always safe; optimism is the enhancement.)
7. **Seam between intents?** Many, all *supported* (not forks): `mutation` ↔ `loader` (read/write split,
   already drawn) · ↔ `reliability` (retry/error-tolerance on the failure branch) · ↔ `action` (trigger
   visual-weight + `busy`) · ↔ Change Tracking / `change-record` (the reversibility record) · ↔ `command` /
   undo-redo #1394 (the inverse-op stack).

## Recommendation summary (for #1395's prepared shape)

- **Supported by default (ratify, not weigh):** `resource-action` stays the home of the running lifecycle;
  optimistic-vs-pessimistic is a configurable dimension (default pessimistic); the reliability/loader/action/
  change-tracking seams are all compositions, not forks.
- **Fork 1 (intent home, conf ~85%):** mint a first-class **`mutation`** intent (write-lifecycle axis,
  symmetric to `loader` for reads); `resource-action` retargets to it and stops squatting on
  `loader.strategy.optimistic`. Rejected: folding into `action` (breaks the visual-weight ⟂ lifecycle
  boundary the platform already draws) or `reliability` (failure-only; can't own the optimistic happy path).
- **Fork 2 (rollback primitive, conf ~75%, shared with #1394):** express the rollback contract over the
  existing **`change-record`** semantic / Change Tracking protocol so optimistic-revert and undo/redo share one
  inverse-data contract; keep `resource-action`'s 1-deep `previousState` snapshot as a permitted fast-path.
  Rejected: a fully independent rollback contract (duplicates change-record, drifts from undo/redo).

## Open residuals for the deciding turn

- Fork 1 naming: `mutation` vs `optimistic-mutation` vs `data-mutation` — lean `mutation` (symmetric to
  `loader`, matches `useMutation`).
- Fork 2 should be **ratified jointly with #1394** (or #1395 (a) ratified as "align on change-record" and
  #1394 inherits it). Flag for the deciding agent's skeptic pass: does coupling optimistic-revert (1-deep,
  synchronous) to the undo/redo stack (N-deep, user-driven) over-generalize? The fast-path carve-out is the
  hedge.
