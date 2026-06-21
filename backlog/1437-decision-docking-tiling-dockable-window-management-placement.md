---
kind: decision
parent: "099"
status: open
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
preparedDate: "2026-06-21"
size: 5
tags: [decision, docking, tiling, partition-tree, dockable, spatial-manipulation, layout, native-first]
relatedReport: reports/2026-06-21-docking-tiling-partition-tree.md
relatedProject: webintents
crossRef: { url: /research/docking-tiling-partition-tree/, label: "Prep survey — docking / tiling (recursive partition-tree)" }
---

# Decision — docking / tiling (dockable window-management): placement of the recursive partition-tree model (golden-layout / dockview / FlexLayout family)

Fork-4 carve-out of [#1384](/backlog/1384-spatial-manipulation-arrangeable-surfaces-resizable-splitter/):
the recursive partition-tree layout model (nested rows/columns of resizable splits whose leaves are
**tab-stacks**, plus drag-to-dock, popout-to-OS-window, and a serialized layout tree) is the **distinct
third spatial-manipulation model** #1384 deferred. The forks below are grounded in a prior-art survey
published as [`/research/docking-tiling-partition-tree/`](/research/docking-tiling-partition-tree/) (report
linked via `relatedReport`). **The ruling can be prepared and ratified now; #1384 is resolved, so its
substrate is ratified** — docking *composes* the `resizable` splitter + the reorder grab/move/drop substrate
#1384 mints, so its realizing build is scheduled with normal burndown once that substrate ships (the stale
`blockedBy: 1384` edge is cleared now that #1384 is resolved). Like [#022](/backlog/022-drag-and-drop-paradigms/), the
expectation is a small fan-out (a `dockable` intent + a composing block, maybe a protocol), not a pre-minted
set; the realizing build is deferred at ratification.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 — Placement of the recursive-tree model** | Standalone `dockable` intent **composing** `resizable` + `tabs` + the arrangeable substrate | A configuration / dimension of `arrangeable` | ~85% |
| **2 — Serialized layout tree** | A first-class WE **Protocol** (escapable interchange schema) | The intent's internal persisted state (no protocol) | ~70% |
| **3 — Popout-to-OS-window scope** | An **optional `dockable` dimension**, deferred to the realizing build | In the core now / its own separate decision | ~75% |

**Settled without a fork** (see *Supported by default* + *Context*): **intent + composing block, no project**
(mirrors #1384's forced-ratify A); the **a11y contract is the composition of two existing APG patterns**
(Window Splitter on the splits + Tabs on the stacks) — no new pattern invented; the **Pointer-Events
substrate + never-HTML-DnD + `Element.moveBefore()` relocation** are inherited fixed mechanics; the
**realizing build is a separately-scheduled item** that composes #1384's now-ratified substrate.

## Axis-framing

The survey's load-bearing finding: the recursive partition-tree is **not a fourth primitive** — it is a
**recursive composition of two node kinds WE already standardizes**, pinned to the real tree:

- **Split nodes** (rows / columns) — a parent partitions its space among children with a draggable splitter
  between siblings. That is the **`resizable` linear-split divider** applied recursively
  (we:src/_data/intents/resizable.json:6, which itself records *"distinct from … a recursive partition/dock
  tree (deferred, #1437)"*).
- **Stack leaves** (tab-stacks) — a leaf holds N panels shown one-at-a-time behind a tab bar. That is the
  **Tabs** pattern WE already ships as the `tabs` block (we:src/_data/blocks/tabs.json:2-18 — native
  exclusive-group `name` + ARIA Tabs).

So the partition-tree adds **no new gesture and no new leaf widget**. It adds exactly four things over the
#1384 baseline: (a) a **recursive container contract** (a node is a row/column/stack, nesting arbitrarily,
space fully partitioned — never a gap or overlap, the structural break from `arrangeable`), (b)
**drag-to-dock** (drop a panel on an edge/center zone to re-tile), (c) **tree serialization**
(dockview `api.toJSON/fromJSON`, FlexLayout `Model.fromJson/toJson` — both a `row→column→stack-of-tabs`
tree), (d) optional **popout-to-window**. The structural contrast with the sibling intent: `arrangeable`'s
state is a **flat `Array<{x,y,w,h}>`** that *can* leave gaps and overlap
(we:src/_data/intents/arrangeable.json:8-16, the `compaction: allow-overlap` dimension); a partition-tree's
state is a **recursive tree** that structurally *cannot*. Two incompatible state shapes → composition, not
overload.

## Fork 1 — Placement: a standalone `dockable` intent, or a configuration of `arrangeable`?

**Why it's a fork:** both branches are coherent and **cannot coexist** — the recursive-tree model either
gets its own intent or becomes a mode of `arrangeable`; the standard ships one shape. The excluded branch
(fold it into `arrangeable`) is *flawed*: `arrangeable`'s contract is the **flat 2-D grid** — a
`Array<{x,y,w,h}>` with collision/compaction (we:src/_data/intents/arrangeable.json:6-16) — and a recursive
partition tree is a structurally different state shape (a tree, no gaps/overlaps ever, shared splitters
between siblings) with different mechanics (re-tile + drag-to-dock, not cell-drag + compaction). Overloading
`arrangeable` would stretch its grid contract over a tree model it never named — the same overload-smell
#1384 rejected for putting 2-D placement onto `reorder` (we:backlog/1384-spatial-manipulation-arrangeable-surfaces-resizable-splitter.md:155-176).

- **(a) Standalone `dockable` intent that composes `resizable` + `tabs` + the #1384 substrate**
  *(recommended)*. The new intent owns the recursive-container model (node = row|column|stack, drag-to-dock,
  no gaps/overlaps) and **reuses** the shipped `resizable` splitter (we:src/_data/intents/resizable.json),
  the `tabs` block for stack leaves (we:src/_data/blocks/tabs.json), and reorder's grab/move/drop +
  live-region + `moveBefore()` substrate (we:src/_data/blocks/reorderable-list.json) — composition over
  overload, the #1384 / [#compose-intent-dont-duplicate](../docs/agent/platform-decisions.md#compose-intent-dont-duplicate)
  shape. Bias-toward-separation: a recursive-tree model that recurs without the flat grid earns its own home.
- **(b) A configuration / dimension of `arrangeable`** *(Rejected — overloads)*. Forces a tree model and
  drag-to-dock onto an intent whose contract is a flat grid with compaction; the two state shapes don't
  unify, and `arrangeable`'s dimensions (`compaction`/`snap`/`resize`) mean nothing in a partition tree.

**Recommended: (a).** *(~85%. Residual: a `dockable` that composes `resizable` + `tabs` is thin enough that
one could argue it is "just a block, not an intent" — but the recursive-container model + drag-to-dock
semantics are a reusable declarative contract, not a single widget, so the intent home holds; flag for the
skeptic.)*

## Fork 2 — Serialized layout tree: a first-class Protocol, or the intent's internal shape?

**Why it's a fork:** both branches are coherent and **cannot coexist** — the `row→column→stack-of-tabs`
serialization is either a standardized WE **Protocol** (a named interchange schema other tools can read /
write) or it is private intent state with no contract; the standard blesses one. The candidate-loser branch
(no protocol) is the one to weigh against WE's lock-in stance: the serialized layout tree is the **single
escapable lock surface** in the whole docking family — if it is an opaque per-impl blob, a project that
adopts one docking impl is locked to it; if it is a standardized schema, the impl is swappable (the
[minimize-lock-in](../docs/agent/platform-decisions.md) / #239 stance — protocols are the *only* lock, and
they must be escapable).

- **(a) A first-class WE Protocol** *(recommended)*. Standardize the layout-tree interchange schema
  (`node = {type: row|column|stack, children|tabs, size}`), the convergent shape dockview/FlexLayout/
  golden-layout all already emit. Makes the docking impl swappable and the saved layout portable;
  conformance = round-trip the tree. This is the rare spatial-manipulation concern that *does* clear the
  [#project-protocol-bar](../docs/agent/platform-decisions.md#project-protocol-bar) (an interchange schema),
  unlike #1384's intents which had none.
- **(b) Intent-internal persisted state (no protocol)** *(Rejected — locks in)*. Treats the saved layout as
  private impl state; a project's persisted dock layout becomes non-portable across impls, the exact
  project-facing-format lock-in WE refuses.

**Recommended: (a).** *(~70%. Residual: whether the tree schema is rich enough across impls to standardize
without lossiness — popout-state, per-panel metadata, and constraint encodings diverge; the protocol may
need to standardize a *core* tree + an open extension slot, which is a build-shape detail, not a placement
reversal. The lower confidence is genuine — flag for the skeptic whether protocol-now vs protocol-later.)*

## Fork 3 — Popout-to-OS-window: an optional dimension, in-core, or its own decision?

**Why it's a fork:** popout is either inside the `dockable` core, an opt-in dimension, or a wholly separate
concern; one disposition ships. The excluded reading (bake it into the core) is *flawed*: popout is
**orthogonal** to recursive partitioning — the tree model is complete without it (FlexLayout / rc-dock tile
strongly with weak/optional popout), and popout is a **generic capability** (move a live subtree to another
`Window` via `window.open()` + `adoptedStyleSheets`) that has nothing to do with the partition contract.
Baking it in would widen the core with a capability most consumers won't use.

- **(a) An optional `dockable` dimension, deferred to the realizing build** *(recommended)*. The core
  `dockable` contract is the in-page tree; `popout: none | window` is an opt-in dimension (most-permissive
  default `none`), specified when the build lands. Keeps the core minimal; bias-toward-separation without
  over-fragmenting (it *is* a docking affordance, just optional).
- **(b) In the core now** *(Rejected — widens)*. Forces a cross-window capability into every consumer's
  contract; orthogonal to the tree model.
- **(c) Its own separate decision.** Coherent but over-fragments — popout is a one-dimension knob on
  `dockable`, not a distinct model warranting a third carve. Folded into (a) as a deferred dimension.

**Recommended: (a).** *(~75%. Residual: popout's cross-window state sync + the `moveBefore`-across-windows
edge cases may prove heavyweight enough to re-carve later; if so it splits out as a build, not a placement
change — the dimension stays the home.)*

---

## Supported by default (not decisions)

- **Intent + composing block, no project.** Mirrors #1384's forced-ratify A (intent[s] + block; no project,
  no orchestration domain). The only open project/protocol question is the *serialized tree* (Fork 2);
  the model itself is plainly an intent + block.
- **The a11y contract is a composition of two existing APG patterns — no new pattern invented.** The W3C
  WAI-ARIA APG set has **no docking pattern**, but it has the two the model decomposes into: **Window
  Splitter** (the splits — already a fixed invariant on `resizable`, we:src/_data/intents/resizable.json:30)
  and **Tabs** (the stacks — already on the `tabs` block, we:src/_data/blocks/tabs.json). The one
  docking-specific keyboard surface (drag-to-dock relocation) reuses the #1384 grab/move/drop + live-region
  mechanic. Pointer-only is the broken branch (inherited from #1384's forced-ratify B).
- **Substrate is inherited, not new.** Pointer Events + `setPointerCapture` (never HTML DnD), CSS Grid/Flex
  partition rendering, `Element.moveBefore()` progressive relocation (`insertBefore` fallback),
  `window.open()` + `adoptedStyleSheets` for popout — all Baseline/progressive and already in play from
  #1384. No new native primitive is required (and none exists: no native dock/tab-stack/split-view element,
  no Open UI / CSSWG / WHATWG proposal in flight).
- **The realizing build is deferred.** Placement/decomposition only; the `dockable` realizing block is a
  separately-scheduled build that composes `resizable` + the reorder substrate #1384 ratified.

## Context

**Classification (per-fork pass, recorded).** Layer = **Intent** (declarative UX "what") + a composing
**Block**; not a Project. The **serialized tree is the one Protocol candidate** (Fork 2) — the single
escapable-lock surface. Exposed as a **dimension-bearing intent** (orientation/sizing/`popout` are
legitimate simultaneous end-states). **Explicit per-surface**, opt-in; absent → a static (non-dockable)
layout (most-permissive). **Composition seam:** `dockable` composes the shipped `resizable` splitter
(we:src/_data/intents/resizable.json), the `tabs` block (we:src/_data/blocks/tabs.json), and reorder's
grab/move/drop + live-region + `moveBefore()` substrate (we:src/_data/blocks/reorderable-list.json) — it adds
no new gesture. **Fixed mechanics** (baked, inherited from #1384): APG Window Splitter + APG Tabs +
live-region announce + Pointer-Events substrate + `moveBefore()` relocation. **Native-first:** gesture,
partition rendering, and popout are native; the standard adds the recursive-container model + drag-to-dock
semantics + the composed a11y contract the platform lacks.

**Relationship to #1384.** This is the **Fork-4 carve-out** (we:backlog/1384-spatial-manipulation-arrangeable-surfaces-resizable-splitter.md:62-66
and :194-208). #1384 ratified the three sibling models (`resizable`, `arrangeable`, `alignment-guides`) over
a shared substrate and deferred this fourth (recursive-tree) model here for its own decision; #1384 is now
resolved, so the substrate + a11y baseline is ratified. The carve is a real contract boundary, not prioritization: the partition-tree is a distinct
*state shape* (a recursive no-gaps tree vs a flat grid), but it **composes** #1384's mechanics rather than
inventing new ones — which is precisely why the ruling can be prepared now while the build waits on #1384.

**Follow-ups to file at resolution:** (1) build — mint the `dockable` intent (Fork 1a) composing
`resizable` + `tabs` + the reorder substrate #1384 ratified; (2) if Fork 2 → protocol: mint the
layout-tree interchange Protocol (`row→column→stack-of-tabs` schema, round-trip conformance); (3) the
`dockable` realizing block (recursive container + drag-to-dock + serialization + the `popout` dimension per
Fork 3a).

## Definition of Ready — met

- ✅ A `/research/` prep survey of the docking incumbents + the native-substrate Baseline check is published
  ([`/research/docking-tiling-partition-tree/`](/research/docking-tiling-partition-tree/), report linked via
  `relatedReport`).
- ✅ Each genuine fork stated with options + a **bold** recommended default + confidence (in the glance
  table and per-fork).
- ☑ `blockedBy: 1384` edge cleared — #1384 is resolved, so the substrate baseline is ratified; the ruling
  is prepared/ratifiable now and the build composes #1384's ratified substrate. See `/next decision` to ratify.
