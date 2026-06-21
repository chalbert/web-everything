---
kind: decision
size: 3
parent: "099"
status: open
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
preparedDate: "2026-06-21"
tags: [decision, book-candidate, undo, redo, history, command, change-tracking, webstates, gap]
relatedReport: reports/2026-06-21-reversible-mutation-history-undo-redo.md
crossRef: { url: /research/reversible-history-model/, label: "Prep survey — reversible mutation history (undo / redo)" }
---

# Decision — Undo / redo (reversible mutation history) standard: placement

**Prepared 2026-06-21 — ready to ratify.** Candidate latent standard surfaced by the verb-axis lens
([#1390](/backlog/1390-interaction-paradigm-inventory-verb-axis-gap-lens-find-missi/)): a reversible
mutation-history model — a navigable undo/redo cursor over applied changes, each knowing its inverse, with
grouping/coalescing and scope. The forks below are grounded in a prior-art survey published as
[`/research/reversible-history-model/`](/research/reversible-history-model/) (report linked via
`relatedReport`). **The survey reshaped the call:** the original three options (own intent / `command`
extension / behavior over `simple-store`) are all wrong-or-mis-coupled once you see that **Web States'
Change Tracking Protocol already ships the reversible-operation contract** — so the placement collapses to
a forced ratify (a history behavior in Web States composing that protocol), and the live forks are about
*how* it composes, not *where* it lives.

## The axes the survey surfaced

Pinned to the real tree:

- **The reversible-operation contract already exists.** Web States' Change Tracking Protocol authored every
  primitive undo needs: the **Change Record** (`path`/`op`/`oldValue`/`newValue`/`source`/`timestamp`),
  carrying `oldValue` *"because RFC 6902 ops are not self-inverting"*
  ([we:src/_data/semantics/change-record.json](../src/_data/semantics/change-record.json)); the **Change
  Patch**, *"an optionally invertible set of Change Records … inverse patches … revert it, enabling
  undo/replay"* ([we:src/_data/semantics/change-patch.json](../src/_data/semantics/change-patch.json)); the
  `CustomChangeStrategy` contract's **optional `applyInverse`** method
  ([we:src/_data/semantics/change-strategy.json](../src/_data/semantics/change-strategy.json)); and a
  `change-source` that already enumerates an `undo` / `replay` origin
  ([we:src/_data/semantics/change-source.json](../src/_data/semantics/change-source.json)). The
  `audit-trail` block already consumes the `{ before, after }` shape
  ([we:src/_data/blocks/audit-trail.json](../src/_data/blocks/audit-trail.json)).
- **Scope is already solved.** `CustomChangeStrategyRegistry` resolves the active strategy *per scope*
  through the injector chain ("a form on snapshot-diff, a collaborative document on a CRDT")
  ([we:src/_data/semantics/change-strategy-registry.json](../src/_data/semantics/change-strategy-registry.json)).
  Undo's scope axis (which subtree / whose changes) needs no new mechanism.
- **`command` is invocation, not history.** [we:src/_data/intents/command.json:5](../src/_data/intents/command.json)
  contracts *"which commands exist, their keybindings, command-palette behaviour"* — an undo/redo *command*
  composes it, but the history *model* is a different layer.
- **`draft-persistence` is the storage facet, undo is the time facet.** Draft Persistence is *"the #011
  storage facet of webstates"* ([we:src/_data/blocks/draft-persistence.json:6](../src/_data/blocks/draft-persistence.json));
  undo/redo is the symmetric navigable-time facet of the same project — adjacent, not the same block.
- **The platform ships an undo *signal*, not a *stack*.** `beforeinput`/`input` with `inputType`
  `historyUndo`/`historyRedo` (W3C Input Events Level 2) is native for editable surfaces; but the HTML5
  `UndoManager` / DOM Transaction proposal was removed and its `Undo API` successor has no traction, so
  there is **no native undo stack** for general app state — the history model must be authored.

## Recommended path at a glance

| Fork | Recommended default | Main alternative (excluded) | Confidence |
|---|---|---|---|
| **1 — Layer** | History **behavior/block composing** the Change Tracking Protocol | Extend the `CustomChangeStrategy` contract with native `undo()`/`redo()` | high |
| **2 — Reversible-op contract** | **Reuse** Change Patch + `applyInverse` | Mint a new per-op `invert()` command contract | high |
| **3 — Grouping / coalescing home** | A **transaction API on the history block** (`transact()` / boundary) | Push grouping into the change strategy | med-high |
| **4 — #1395 relationship** | **Share the inverse-op primitive, separate runtimes** | One unified rollback+history manager | med-high |

## Forced ratifies (not forks — stated for the record)

- **Placement → a reference history behavior/block in Web States composing the Change Tracking Protocol;
  no new project, no new intent, no `command` extension, no `simple-store` coupling.** The three excluded
  readings are *broken*, not weighed: (a) **own intent** is broken — intents are UX-only and undo/redo is a
  *mechanism* (a stack + inverse contract), with its UX affordances composing existing intents (`command`
  to invoke, `feedback`/`notification` for an "undone X" toast, `status-indicator` for `canUndo` enabled
  state); (b) **`command` extension** is broken — `command` = invoke, not state, and cannot host a history
  model; (c) **behavior over `simple-store`** is right in spirit but mis-coupled — it must compose the
  *abstract* `CustomChangeStrategy` / Change Patch, never the concrete `SimpleStore`, so any store/signal/
  document strategy gets undo (bias-toward-separation). A new *project* is over-mint — Web States already
  owns change tracking. Codified by [we:docs/agent/platform-decisions.md](../docs/agent/platform-decisions.md)
  (#project-protocol-bar) + the "Intent UX-only, technical→Configurator" rule.
- **Scope → reuse `CustomChangeStrategyRegistry` (fixed mechanic).** Per-subtree / per-origin scope is the
  registry's existing job; the history block reads its active strategy from the nearest scope. Re-minting a
  scope mechanism is the broken branch.
- **Editable-surface undo → consume the native `historyUndo`/`historyRedo` `InputEvent` where present
  (fixed mechanic, native-first).** For `contenteditable`/`input`/`textarea` the history block bridges the
  cancelable `beforeinput` signal into its stack rather than re-deriving keystroke intent. Ignoring the
  native signal is the broken branch.

## Fork 1 — Layer: history behavior composing the protocol vs. extending the protocol contract

*Fork-existence:* both branches are coherent and **cannot coexist** — the navigation lives either *on top
of* the Change Tracking Protocol (a new consumer) or *inside* it (the strategy contract grows
undo/redo). The standard ships one shape.

- **(a) A reference history behavior/block that composes the existing protocol** *(recommended)*. An
  undo-manager that consumes a `CustomChangeStrategy` (uses `applyInverse` + the Change Patch stream),
  owns the past/present/future cursor, grouping, and stack bounds, and reads its scope from
  `CustomChangeStrategyRegistry`. Merit: bias-toward-separation; the protocol already exposes everything
  needed (`applyInverse`, the invertible Change Patch, the scope registry, the `change-reverted` event), so
  history is *pure composition* with **no protocol change**; native-first (it bridges `historyUndo`).
- **(b) Extend the `CustomChangeStrategy` contract** with built-in `undo()`/`redo()`/cursor. *Rejected* —
  it couples navigation into *every* strategy, but a CRDT or native-signals strategy is a change *source*,
  not a history store; forcing each impl to carry a redo stack violates separation and burdens conformance.
  The contract's job is to *emit and invert* changes, not to *navigate* them.

## Fork 2 — Reversible-operation contract: reuse Change Patch vs. mint a new inverse contract

*Fork-existence:* both are coherent contract designs, **cannot coexist** as the one contract — undo stores
either Change Patches or a new operation type. The "mint new" branch is excluded because it *duplicates a
shipped, already-consumed contract* (the redundancy criterion).

- **(a) Reuse Change Patch (JSON Patch + inverse `oldValue`) + `CustomChangeStrategy.applyInverse`**
  *(recommended)*. The history stack stores Change Patches; undo = `applyInverse`, redo = re-apply forward.
  Merit: DRY — the invertible Change Patch and `applyInverse` already ship and `audit-trail` + the
  `change-reverted` event already consume them; aligns to RFC 6902 + Immer/Mutative's forward+inverse patch
  pairs (the survey's incumbent convergence). A bespoke inverter (command-pattern `invert()`) is *not lost*
  — a custom `CustomChangeStrategy` can supply `applyInverse` however it likes, so the command-pattern case
  is already a value of this contract, not an alternative to it.
- **(b) Mint a new per-operation `invert()` command contract** (GoF command-pattern objects with
  `execute`/`undo`). *Rejected* — it re-mints what Change Patch + `applyInverse` already provide and splits
  the ecosystem's inverse representation in two; the legitimate command-pattern use folds into (a) as a
  custom strategy.

## Fork 3 — Grouping / coalescing: a transaction API on the history block vs. in the change strategy

*Fork-existence:* both coherent, **cannot coexist** — "what counts as one undo step" is owned by exactly
one layer. Grouping is the *one* thing the protocol does not model (it streams individual Change Records),
so it must be placed.

- **(a) A transaction API on the history block** *(recommended)* — `history.transact(() => { … })` (or a
  time-window coalescer + an explicit boundary) groups the records emitted during a unit into one undo
  step, mirroring ProseMirror `newGroupDelay`/`closeHistory`, Yjs `captureTimeout`, Quill `delay`,
  redux-undo `groupBy`. Merit: undo *granularity* is a history/UX concern (how a user perceives "one
  change"), distinct from how a strategy *detects* changes; keeping it on the history block lets the same
  strategy back different undo granularities in different surfaces.
- **(b) Push grouping into the change strategy** (the strategy emits pre-grouped patches). *Rejected* — it
  makes a detection-layer component decide a UX policy; a CRDT/signals strategy has no basis to know what a
  user considers one undo, and two surfaces sharing a strategy could not differ in granularity.

## Fork 4 — Relationship to optimistic mutation (#1395): shared primitive vs. unified manager

*Fork-existence:* both coherent, **cannot coexist** — either undo and optimistic-rollback are one runtime
or two; the survey shows they share the *primitive* (`applyInverse` of a Change Patch) but differ in
*lifetime and visibility*. Cross-references
[#1395](/backlog/1395-optimistic-mutation-apply-reconcile-rollback-standard-placem/) (decide consistently).

- **(a) Share the reversible-operation primitive (Change Patch + `applyInverse` in Web States), keep
  separate runtimes** *(recommended)*. Optimistic rollback is a transient single-step revert of one
  in-flight change; undo/redo is a durable user-facing navigable stack. Merit: DRY at the primitive while
  honouring that an optimistic rollback **must not** land on the user's undo stack (you don't "redo" a
  failed server write). #1395 should adopt the same `applyInverse` primitive; this is the coordinated
  position to carry into that decision.
- **(b) One unified rollback+history manager** owning both. *Rejected* — it conflates lifetimes (in-flight
  network reconciliation vs. user-facing time travel) and would pollute the undo stack with transient
  reconciliation steps, producing wrong UX.

## What this is NOT

- Not a commitment to build — placement / decomposition only; the realizing history behavior/block is a
  deferred build spun out via a `blockedBy` chain at ratification.
- Not a new reversible-operation contract — the survey's decisive finding is that Web States already ships
  it; this decision adds only the navigable cursor + grouping + the editable-surface signal bridge.

## Definition of Ready — met

- ✅ A `/research/` prep survey (native substrate Baseline check + incumbent editor/state libraries +
  reuse audit vs. the in-tree Change Tracking Protocol) is published
  ([`/research/reversible-history-model/`](/research/reversible-history-model/), report via `relatedReport`).
- ✅ Each fork stated with options + a **bold** recommended default + confidence + a fork-existence line.
- ⬜ `preparedDate` stamped on release — see `/next decision` to ratify.
