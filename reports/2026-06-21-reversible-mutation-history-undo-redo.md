# Reversible mutation history (undo / redo) — prep survey

> Prepares decision [#1394](/backlog/1394-undo-redo-reversible-mutation-history-standard-placement/)
> (under epic [#099](/backlog/099-evergreen-app-vision/)). Prior-art survey of the native undo
> substrate + the incumbent editor/state libraries, cross-checked against what Web States' **Change
> Tracking Protocol** already ships, so the eventual `/decision` turn ratifies rather than researches.
> Published as the `/research/reversible-history-model/` topic.

## The gap (verb-axis lens, 2026-06-21)

The verb-axis lens ([#1390](/backlog/1390-interaction-paradigm-inventory-verb-axis-gap-lens-find-missi/))
flagged **undo / redo (reversible history)** as a vacant row: WE owns *invocation* (`command` intent,
Baseline Invoker Commands) and *durable save* (`draft-persistence` block), but **neither models a
navigable stack of reversible changes** — a cursor over applied mutations, each knowing its inverse, with
grouping/coalescing and scope.

## Method

Two surveys: (1) the **native web-platform substrate** for undo, with current Baseline status, verified
against MDN / W3C Input Events / WHATWG history; (2) the leading **editor + state libraries** that ship an
undo manager, verified against their docs. Then a reuse audit against the existing in-tree
`change-*` semantics.

## Finding 1 — the platform ships an undo *signal* for editable surfaces, but **no general undo stack**

- **`beforeinput` / `input` with `inputType` `historyUndo` / `historyRedo`** (W3C Input Events Level 2) is
  the standards-compliant native undo *signal*. When the user hits Ctrl+Z / Ctrl+Y or uses the browser
  undo UI inside an editable element, the browser fires `beforeinput` (cancelable) then `input` with that
  `inputType`. This lets an app intercept and drive its own stack — but it is **scoped to editable
  surfaces** (`contenteditable`, `<input>`, `<textarea>`), not arbitrary app state.
  ([MDN InputEvent.inputType](https://developer.mozilla.org/en-US/docs/Web/API/InputEvent/inputType),
  [Input Events Level 2](https://www.w3.org/TR/input-events-2/))
- **`document.execCommand('undo'|'redo')`** — deprecated; do not standardize on it.
- **There is no general native DOM undo stack.** The HTML5 `UndoManager` / DOM Transaction proposal was
  **removed** (~2011–2013; Firefox removed its implementation in
  [bug 1310385](https://bugzilla.mozilla.org/show_bug.cgi?id=1310385)). A later
  [Undo API](https://rniwa.github.io/undo-api/) and [whsieh/UndoManager](https://github.com/whsieh/UndoManager)
  exposing the native stack via `UndoItem` have **no traction**. So for non-editable / general app state
  (form models, dashboard layout, canvas, list mutations) there is no platform primitive — confirming this
  is a real, durable gap.

**Native-first take:** the undo *signal* for editable surfaces is native (`historyUndo`/`historyRedo`
`inputType`) and the standard should consume it; the *stack model* for general state has no native
substrate and must be authored.

## Finding 2 — every incumbent undo manager is a **navigable cursor over invertible operations**

| Library | Representation | Grouping / coalescing | Scope |
|---|---|---|---|
| ProseMirror `prosemirror-history` | document transactions (steps + inverted steps) | `newGroupDelay` time window; `closeHistory` boundary | per-editor-state |
| CodeMirror `@codemirror/commands` | document changes (invertible) | time-window; `isolateHistory` annotation | per-editor-state |
| Lexical history plugin | editor-state diffs | merge window | per-editor |
| Quill history module | Delta + inverted Delta | `delay` window; `maxStack`; `userOnly` | per-editor |
| Yjs `Y.UndoManager` | CRDT inverse ops | `captureTimeout` window | `trackedOrigins` + scoped types (undo only *my* edits) |
| redux-undo | past / present / future state stacks | `groupBy`; `filter` | per-reducer slice |
| Immer / Mutative | forward + **inverse JSON Patches** (`produceWithPatches`) | caller-grouped | per-`produce` call |

The shape is universal across all of them: a **past/present/future cursor**, where each entry is an
**invertible operation** (an inverse step, an inverse Delta, an inverse patch, or a counter-op), plus a
**time-window/transaction coalescer** that decides "what counts as one undo", plus a **scope** (which
target / which origin's changes the stack tracks). None of them is an *intent* (a UX axis); each is a
*mechanism* — a manager class behind a contract.

## Finding 3 — the reversible-operation contract **already ships** in Web States change-tracking

This is the load-bearing finding. WE already authored the substrate undo needs, as the **Change Tracking
Protocol** (research topic
[`change-tracking-observability`](/research/change-tracking-observability/), Web States):

- [we:src/_data/semantics/change-record.json](../src/_data/semantics/change-record.json) — **Change
  Record**: `path` (RFC 6901), `op` (RFC 6902), `oldValue`/`newValue`, `source`, `timestamp`, `version`.
  *"`oldValue` is carried because RFC 6902 ops are not self-inverting"* — i.e. invertibility is already a
  designed-in property.
- [we:src/_data/semantics/change-patch.json](../src/_data/semantics/change-patch.json) — **Change Patch**:
  *"A serializable, optionally invertible set of Change Records aligned to JSON Patch (RFC 6902). … inverse
  patches … revert it, **enabling undo/replay**. Immer and Mutative emit forward + inverse patch pairs."*
- [we:src/_data/semantics/change-strategy.json](../src/_data/semantics/change-strategy.json) — the
  `CustomChangeStrategy` contract carries an **optional `applyInverse`** method. The inverse-application
  primitive already exists and is feature-detected.
- [we:src/_data/semantics/change-strategy-registry.json](../src/_data/semantics/change-strategy-registry.json)
  — `CustomChangeStrategyRegistry` resolves the active strategy **per scope** through the injector chain
  ("a form on snapshot-diff, a collaborative document on a CRDT"). Undo's *scope* axis is already solved.
- [we:src/_data/semantics/change-source.json](../src/_data/semantics/change-source.json) — Change Source
  already enumerates an **`undo`** / `replay` origin value.
- Consumer proof: [we:src/_data/blocks/audit-trail.json](../src/_data/blocks/audit-trail.json) already
  consumes the `{ before, after }` Change Record shape, and `change-patch` notes the **`change-reverted`
  event applies an inverse Change Patch**.

**Conclusion:** undo/redo is **not** a new reversible-operation contract. It is a **navigable history
cursor** layered *on top of* the existing Change Patch + `applyInverse` primitive — adding only (a) the
past/present/future stack, (b) transaction grouping/coalescing (what the protocol does not model: it
streams individual records), and (c) the editable-surface `historyUndo` signal bridge. The home is
therefore **Web States**, as a reference *history behavior/block* composing the Change Tracking Protocol —
not a new intent, not a `command` extension, not a binding to the concrete `simple-store`.

## Finding 4 — optimistic mutation ([#1395](/backlog/1395-optimistic-mutation-apply-reconcile-rollback-standard-placem/)) shares the *primitive*, not the *stack*

Optimistic mutation's "roll back on failure" is exactly `applyInverse` of one uncommitted Change Patch.
So both standards sit on the **same reversible-operation primitive** — but they differ in *lifetime and
who-sees-it*: optimistic rollback is a transient, single-step revert of an in-flight change that **must
not** land on the user's undo stack (you don't "redo" a failed server write); undo/redo is a durable,
user-facing navigable stack. Recommendation: **share the primitive (Change Patch + `applyInverse` in Web
States), keep separate runtimes.** This should be the coordinated position when #1395 is decided.

## What this reshapes

The item's original three options (own intent / `command` extension / behavior over `simple-store`) are
**all wrong or under-specified** once Finding 3 lands: own-intent is excluded (undo is a mechanism, not a
UX axis); `command` extension is excluded (`command` = invoke, not state); "behavior over `simple-store`"
is right in *spirit* (a behavior) but wrong in *coupling* (it should compose the abstract
`CustomChangeStrategy` / Change Patch, never the concrete `simple-store`). The live forks become: (1) the
layer within Web States — history behavior composing the protocol vs. extending the protocol contract;
(2) reuse the Change Patch contract vs. mint a new inverse contract; (3) where grouping/coalescing lives;
(4) the #1395 sharing relationship.
