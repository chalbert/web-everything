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
preparedDate: "2026-06-21"
tags: [decision, book-candidate, optimistic, mutation, data-lifecycle, gap]
relatedReport: reports/2026-06-21-optimistic-mutation-placement.md
---

# Optimistic mutation — apply, reconcile, rollback standard: placement

**No design is greenfield here — the premise that WE has "no apply-then-reconcile-then-rollback model" is
false.** WE already ships the optimistic-mutation lifecycle as the `resource-action` block
(`withOptimisticMutation` trait, a `resource-action-revert` event, a `previousState` snapshot). So this is a
**contract-placement** decision, not a build, prepared from a prior-art survey published as the `/research/`
topic [optimistic-mutation-lifecycle](/research/optimistic-mutation-lifecycle/) (session report linked via
`relatedReport`). Two genuine forks remain, each with a **bold** default below; everything else is *supported
by default*. Shares a reversibility primitive with undo/redo
([#1394](/backlog/1394-undo-redo-reversible-mutation-history-standard-placement/)).

## Ruling (ratified 2026-06-21)

**Fork 1 → (a) mint a first-class `mutation` intent** *(~85%)*. The write-lifecycle axis gets its own
intent (`strategy` optimistic/pessimistic · rollback · reconcile · `doubleSubmit` · `busy`), **symmetric to
`loader` for reads**. Grounding sharpened the case: `loader.strategy.optimistic`
([we:src/_data/intents/loader.json](../src/_data/intents/loader.json)) genuinely means *"don't block the UI,
sync in background"* — a **read/pending** concept; the write meaning *"apply a predicted result, roll back on
error"* is a different axis wearing the same word. Minting `mutation` separates the homonyms cleanly — loader
keeps `optimistic` for non-blocking reads, `mutation.strategy.optimistic` owns apply/rollback. `command`
([we:src/_data/intents/command.json:5](../src/_data/intents/command.json#L5), *"orthogonal to the Action
Intent (visual weight)"*) is the precedent. **(b) fold into `action`** and **(c) into `reliability`** rejected
as written (action = visual weight; reliability = failure-path only, cannot own the optimistic *happy* path).
**Name = `mutation`** (the whole write axis, matching `useMutation` ≠ `useQuery`; optimistic is one value of
`strategy`, so not `optimistic-mutation`). `resource-action` retargets `implementsIntent: mutation` (still
drawing on `action` for trigger weight).

**Fork 2 → (a) share the reversibility primitive over `change-record` / Change Tracking** *(~75%)*. Optimistic
revert restores a record's `oldValue` (carried *"because RFC 6902 ops are not self-inverting"*,
[we:src/_data/semantics/change-record.json:4](../src/_data/semantics/change-record.json#L4)) — the same
inverse-data #1394's undo stack replays. One inverse-data contract, not two drifting ones. `resource-action`
**MAY keep its 1-deep `previousState` snapshot as a permitted fast-path**. Scope chosen in discussion:
**ratify (a) as "align on `change-record`" here; #1394 inherits it** (same end-state, lower joint-ratification
coupling). The ~75% (vs Fork 1's ~85%) is the 1-deep↔N-deep coupling — the one place over-generalization could
bite, mitigated by the fast-path carve-out.

**Red-team outcome.** Fork 1's "loader already has `optimistic`, so `mutation` is redundant" attack *fails* —
they are homonyms on different axes (read-blocking vs write-apply), which argues *for* the split. Fork 2's
1-deep↔N-deep coupling risk is handled by letting #1394 inherit rather than co-ratifying, plus the fast-path.
No principle violated (impl-is-not-a-standard holds: the running lifecycle stays in `resource-action`/FUI;
only the intent + reversibility *contracts* move).

**Spin-out builds (blockedBy chain):** [#1431](/backlog/1431-mint-the-mutation-intent-write-lifecycle-axis-symmetric-to-l/)
mint the `mutation` intent → [#1432](/backlog/1432-retarget-resource-action-to-implementsintent-mutation-fix-op/)
retarget `resource-action` + fix `intentDimension` → [#1433](/backlog/1433-wire-optimistic-revert-rollback-onto-change-record-change-tr/)
wire the change-record rollback contract (jointly with #1394).

## Axis framing — what's actually open

The lifecycle the field converged on (TanStack `useMutation` `onMutate`/`onError`/`onSettled`, Apollo
`optimisticResponse`, SWR `useSWRMutation`, RTK `patchResult.undo()`) is **already implemented** in WE:
[we:src/_data/blocks/resource-action.json:6](../src/_data/blocks/resource-action.json#L6) (*"async mutation
lifecycle … optimistic updates with automatic rollback on error"*), the `withOptimisticMutation` trait at
[we:src/_data/blocks/resource-action.json:153](../src/_data/blocks/resource-action.json#L153), and the
`resource-action-revert` event carrying `previousState` at
[we:src/_data/blocks/resource-action.json:78](../src/_data/blocks/resource-action.json#L78). It even mirrors
the framework prior art directly ([we:src/_data/blocks/resource-action.json:110-145](../src/_data/blocks/resource-action.json#L110-L145)).

What's *unresolved* is two contract questions the implementation exposes, on orthogonal axes:

1. **Intent home (naming axis).** `resource-action` declares `implementsIntent: action`, but the `action`
   intent ([we:src/_data/intents/action.json](../src/_data/intents/action.json)) is purely *visual-weight*
   (`level`/`variant`/`disposition`/`busy`/`groupOrdering`) — the `command` intent's own summary calls itself
   *"orthogonal to the Action Intent (visual weight)"*
   ([we:src/_data/intents/command.json](../src/_data/intents/command.json)). The mutation trait squats on
   `loader.strategy.optimistic` ([we:src/_data/blocks/resource-action.json:155](../src/_data/blocks/resource-action.json#L155)),
   a *read-side* blocking dimension ([we:src/_data/intents/loader.json](../src/_data/intents/loader.json)).
   The write-lifecycle axis has no intent.
2. **Rollback primitive (reversibility axis).** The `change-record` semantic already carries `oldValue`
   *"because RFC 6902 ops are not self-inverting"*
   ([we:src/_data/semantics/change-record.json](../src/_data/semantics/change-record.json)) — the exact
   inverse data an optimistic revert restores and undo/redo (#1394) replays.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **Fork 1** — intent home for the mutation lifecycle | (a) mint a first-class `mutation` intent | (b) fold a lifecycle dimension into `action` | High (~85%) |
| **Fork 2** — rollback contract | (a) share `change-record` reversibility with #1394 | (b) keep optimistic rollback self-contained | Med-high (~75%) |

## Fork 1 — where does the optimistic-mutation lifecycle live at the intent layer?

*Fork-existence:* the lifecycle is implemented but has **no owning intent** — it borrows `loader.strategy`,
a read/blocking axis. A contract lives in exactly one place, so the branches cannot coexist; the **excluded
branch is folding it into `action`**, which reopens the visual-weight ⟂ lifecycle boundary the platform
already draws (`command` is explicitly orthogonal to `action`), and `reliability` is scoped *"strictly for
operation/system failure, not the success path"* so it cannot own optimistic *apply*.

- **(a) Mint a first-class `mutation` intent** — the write-lifecycle axis (`strategy` optimistic/pessimistic ·
  rollback · reconcile · `doubleSubmit` · `busy`), **symmetric to `loader` for reads** (the read/write split
  WE already draws at [we:src/_data/blocks/resource-action.json:93](../src/_data/blocks/resource-action.json#L93)).
  `resource-action` retargets `implementsIntent: mutation` (still drawing on `action` for the trigger's
  visual weight), and `withOptimisticMutation.intentDimension` moves from `loader.strategy.optimistic` →
  `mutation.strategy.optimistic`. *Tradeoff:* one new intent, but it's the axis the whole field treats as
  first-class (`useMutation` ≠ `useQuery`).
- **(b) Extend the `action` intent with a mutation/lifecycle dimension.** *Rejected* — `action` is the
  visual-weight axis consumed by every button for prominence; bolting a write-lifecycle dimension onto it
  collapses two axes the platform deliberately keeps orthogonal (the same separation that gave `command` its
  own intent).
- **(c) Make it a dimension of `reliability`.** *Rejected* — reliability is failure-recovery only (its scope
  note: failure, *not the success path*). Optimistic *apply* is the happy path. Reliability is a **seam**
  `mutation` composes for the error branch (retry/tolerance), not the owner.

**Default: Fork 1 (a)** — mint `mutation`. *Residual:* the name (`mutation` vs `optimistic-mutation` vs
`data-mutation`); lean `mutation` (symmetric to `loader`, matches `useMutation`).

## Fork 2 — is the rollback contract shared with undo/redo, or self-contained?

*Fork-existence:* both this decision (optimistic revert) and #1394 (undo/redo) must **invert an applied
change**, and the `change-record` semantic already centralizes the inverse data (`oldValue`). Either there is
one reversibility primitive or two — they cannot both be *the* contract. The **excluded branch is full
independence**, which re-implements the inverse-data machinery `change-record` exists to centralize and lets
optimistic-revert's snapshot drift from undo's inverse-op.

- **(a) Share the reversibility primitive over `change-record` / the Change Tracking protocol.** Optimistic
  revert restores a record's `oldValue`; undo/redo (#1394) builds its stack from the same records — one
  inverse-data contract. `resource-action` MAY keep its 1-deep `previousState` snapshot as a permitted
  fast-path (sharing the *contract* doesn't forbid a local optimization). *Tradeoff:* couples the simple
  (1-deep, synchronous) case's contract to the complex (N-deep, user-driven) one — mitigated by the fast-path
  carve-out.
- **(b) Keep optimistic rollback self-contained** (its own `previousState` snapshot, no link to a shared
  record). *Rejected* — duplicates `change-record`'s inverse-data machinery; a consumer wanting both optimistic
  writes *and* undo would bridge two incompatible rollback models.

**Default: Fork 2 (a)** — align on `change-record`. *Residual / for the deciding skeptic:* ratify **jointly
with #1394** (or ratify (a) here as "align on change-record" and let #1394 inherit it). Confidence is
med-high, not high, because the 1-deep↔N-deep coupling is the one place over-generalization could bite.

---

## Supported by default — not decisions (support all coherent, mandate nothing)

- **The running lifecycle stays in `resource-action`** (FUI block). Ratify the home; don't re-decide it.
- **Optimistic vs pessimistic is an author-configurable dimension**, both legitimate end-states; **default
  pessimistic** (await server, then apply — always safe; optimism is the opt-in, requiring a predicted
  result). The most-permissive-default per the classification pass.
- **Reconcile/transport via Custom Clients**, retry/error-tolerance **delegated to `reliability`**, trigger
  visual-weight + `busy` from `action`, cache invalidation reusing the loader's stale/refetch model — all
  **seams**, all supported, none a fork.
- The same optimistic pattern recurs in `reaction` (`optimisticallyUpdated`) and `reorderable-list`
  (pluggable commit strategy) — evidence the named contract earns its keep, not separate decisions.

## Per-fork classification (the 7-question pass)

1. **Layer** — lifecycle axis = **Intent** (`mutation`); running impl = **Block** (`resource-action`, FUI);
   reversibility = **Semantic → Protocol** (`change-record` → Change Tracking).
2. **Protocol vs dimension** — mutation UX = intent dimension (no own interop story); the reversibility record
   = protocol (snapshot/JSON-Patch/CRDT all map into it).
3. **Expose whole axis** — yes; strategy is configurable, not baked.
4. **Fixed vs dimension** — strategy = dimension; rollback-on-error *within* optimistic, and double-submit
   prevention = fixed mechanics.
5. **DI-injectable** — reconcile/transport via Custom Clients (DI); commit/rollback strategy resolvable via the
   ambient channel.
6. **Most-permissive default** — strategy = pessimistic (always-safe); optimism is the opt-in.
7. **Seams** — `mutation` ↔ `loader` (read/write) · ↔ `reliability` (failure branch) · ↔ `action`
   (trigger weight) · ↔ Change Tracking/`change-record` (reversibility) · ↔ `command`/undo-redo #1394.

## Sequencing & relationships

- Surfaced by the verb-axis ([#1390](/backlog/1390-interaction-paradigm-inventory-verb-axis-gap-lens-find-missi/))
  and data-lifecycle ([#1403](/backlog/1403-discovery-lens-data-lifecycle-paradigms-load-cache-mutate-sy/)) lenses.
- **Ratify Fork 2 jointly with [#1394](/backlog/1394-undo-redo-reversible-mutation-history-standard-placement/)**
  (shared rollback primitive) — both should land on `change-record`.
- On resolution, the spin-out builds (mint the `mutation` intent; retarget `resource-action`; fix the trait's
  `intentDimension`; wire the change-record rollback contract) become agent-ready items via a `blockedBy`
  chain. **Needs `/next decision`** to make the call.
