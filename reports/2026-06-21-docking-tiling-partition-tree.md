# Docking / tiling (recursive partition-tree) — prep survey

> Prepares decision [#1437](/backlog/1437-decision-docking-tiling-dockable-window-management-placement/)
> (Fork-4 carve-out of [#1384](/backlog/1384-spatial-manipulation-arrangeable-surfaces-resizable-splitter/),
> under epic [#099](/backlog/099-evergreen-app-vision/)). #1384 found docking is a genuinely **distinct
> third layout model** and deferred it here, `blockedBy` #1384 for the shared a11y + Pointer-Events
> substrate baseline. Prior-art survey of the docking incumbents + a native-substrate Baseline check so the
> eventual `/decision` turn ratifies rather than researches. Published as the
> `/research/docking-tiling-partition-tree/` topic.

## The gap (2026-06-21 sweep)

#1384 ratified three placements for user-driven spatial manipulation and minted the substrate: a standalone
**`resizable`** splitter intent (we:src/_data/intents/resizable.json), an **`arrangeable`** 2-D grid intent
(we:src/_data/intents/arrangeable.json), and a standalone **`alignment-guides`** intent — all over a shared
fixed-mechanic baseline (Pointer Events + `setPointerCapture`, never HTML DnD; APG Window Splitter / APG Grid
a11y contracts; live-region announce; `Element.moveBefore()` progressive). What it deferred to this item is
the **recursive partition-tree** model: the golden-layout / dockview / FlexLayout / rc-dock family —
nested rows/columns of resizable splits whose leaves are **tab-stacks**, with drag-to-dock, popout-to-OS-window,
and a serialized layout tree. Both shipped intents already point at this gap:
we:src/_data/intents/resizable.json:6 ("distinct from … a recursive partition/dock tree (deferred, #1437)")
and we:src/_data/intents/arrangeable.json:32 ("a recursive partition tree (dock/tile, deferred #1437)").

## Method

Two parallel surveys: (1) the leading docking JS libraries (dockview, golden-layout, FlexLayout, rc-dock,
lumino/PhosphorJS, the Theia/VS Code layout), verified against npm trends + project docs; (2) the native
web-platform substrate + the WAI-ARIA APG pattern set, verified against MDN / Open UI / W3C WAI-ARIA APG.

## Finding 1 — the partition-tree is a composition of #1384's pieces, not a fourth primitive

Decompose what golden-layout / dockview / FlexLayout actually *are* and the model is a **recursive tree of
two node kinds WE already standardizes**:

- **Split nodes** (rows / columns) — a parent partitions its space among children with **draggable
  splitters between siblings**. That divider is *exactly* the `resizable` linear-split model
  (we:src/_data/intents/resizable.json), applied recursively. dockview names this the "Splitview" /
  "Gridview"; golden-layout names it `row` / `column`.
- **Stack leaves** (tab-stacks) — a leaf node holds N panels shown one-at-a-time behind a tab bar. That is
  the **Tabs** pattern WE already ships as the `tabs` block (we:src/_data/blocks/tabs.json:2-18, native
  exclusive-group `name` + ARIA Tabs). dockview names this a "group"; golden-layout a `stack`.

So the partition-tree adds **no new gesture and no new leaf widget** — it adds (a) a **recursive container
contract** (a node is a row/column/stack, nesting arbitrarily), (b) **drag-to-dock** (drop a panel onto an
edge/center drop-zone to re-tile the tree), (c) **tree serialization**, and (d) optional
**popout-to-window**. The convergent vocabulary across all four libraries is the same: `row` / `column`
(or `branch`) → `stack` / `group` → `tab` / `component`. dockview's `api.toJSON()` / `api.fromJSON()` and
FlexLayout's `Model.fromJson()` / `model.toJson()` both serialize precisely this `row→column→stack-of-tabs`
tree.

## Finding 2 — popout-to-OS-window is a separate, optional capability (not part of the tiling model)

golden-layout and dockview both offer **popout windows** — detach a tab-stack into a real second browser
window (`window.open()` + cloning `adoptedStyleSheets` / moving the DOM subtree). This is **orthogonal** to
the partition-tree: the tree model is complete without it (FlexLayout and rc-dock ship strong tiling with
weak/optional popout), and popout is a generic *capability* (move a live subtree to another `Window`) that
has nothing to do with recursive partitioning. It is a candidate dimension/own-concern, **not** intrinsic to
the dock model — bias-toward-separation flags it as a separate decision/dimension, recommended **out of the
core** and deferred.

## Finding 3 — keyboard / ARIA: there is NO native APG pattern for docking; it composes two that exist

The most load-bearing finding for placement. The W3C WAI-ARIA APG pattern set (32 patterns) has **no
"docking" / "tiling" / "window-manager" / "panel-layout" pattern** — but it *does* have the two patterns the
model decomposes into: **Window Splitter** (the splitters, `role="separator"` + `aria-valuenow/min/max` +
arrows/Home/End) and **Tabs** (the stacks). So docking's a11y contract is **not new** — it is the
composition of the APG Window Splitter contract `resizable` already carries
(we:src/_data/intents/resizable.json:30, the fixed APG-Window-Splitter invariant) and the APG Tabs contract
the `tabs` block already carries (we:src/_data/blocks/tabs.json). The *one* genuinely
docking-specific keyboard surface with no APG precedent is **drag-to-dock relocation** (move a panel to
another region by keyboard) — and that is the same grab/move/drop + live-region announce mechanic the #1384
substrate already mandates for `arrangeable` (we:src/_data/intents/arrangeable.json APG-Grid invariant).
Across the incumbents, keyboard/ARIA for the docking manipulation is **absent** (golden-layout, dockview,
FlexLayout, rc-dock all ship zero) — the same unmet-need #1384 Finding 3 reported, and exactly where a
standards-led design has leverage.

## Finding 4 — native-substrate Baseline check: nothing new is needed below the model

| Primitive | Role for docking | Baseline status |
|---|---|---|
| **Pointer Events** + `setPointerCapture` | the drag substrate for splitters + drag-to-dock | **Baseline** — already #1384's substrate |
| **CSS Grid / Flexbox** | renders the row/column partition at each tree level | **Baseline** |
| **`Element.moveBefore()`** | state-preserving panel relocation when re-tiling (keeps focus/anim/iframe) | **Limited** → progressive, `insertBefore` fallback (same as #1384) |
| **`window.open()` + `adoptedStyleSheets`** | popout-to-window (clone styles into the child window) | **Baseline** — the only popout substrate; no special primitive |
| **APG Window Splitter** | a11y contract for the splitters | spec contract (via `resizable`) |
| **APG Tabs** | a11y contract for the stacks | spec contract (via `tabs` block) |
| **Native dock / tab-stack / split-view element** | — | **Does not exist; no Open UI / CSSWG / WHATWG proposal in flight** (confirmed gap; Popover/Invokers are unrelated) |

**Bottom line:** the partition-tree needs **no new substrate primitive** below #1384's baseline. The gap is
purely the **compositional model** (a recursive container contract + drag-to-dock + serialization) layered
over the splitter, tabs, and grid-drag mechanics WE already standardizes. That is precisely why the carve is
correct *and* why it is `blockedBy` #1384 — the build cannot land until the `resizable` + reorder substrate
it composes is real.

## How the survey reshaped the forks

The thin stub's three candidate concerns (own intent vs config of arrangeable? · popout in scope? · is the
serialized tree a protocol?) survive the standing fork-existence test as **three genuine forks** + several
support-by-default settlements:

- **Fork 1 — Placement of the recursive-tree model:** its **own `dockable` intent composing
  `resizable` + `tabs` + the arrangeable substrate** vs a configuration/dimension of `arrangeable`. Finding 1
  shows the *mechanics* compose, but the *contract shape* (a recursive tree, no gaps/overlaps ever) is
  structurally distinct from `arrangeable`'s flat `Array<{x,y,w,h}>` — so a separate intent that *composes*,
  not a dimension that *overloads*.
- **Fork 2 — Serialized layout tree: a Protocol, or an intent-internal shape?** The `toJSON/fromJSON`
  layout tree is the one candidate lock-in surface in the whole family. Is it a first-class WE **Protocol**
  (an interchange schema, escapable lock) or just the intent's internal persisted state (no protocol)?
- **Fork 3 — Popout-to-OS-window scope:** in the `dockable` core, an optional dimension, or its own
  deferred concern? Finding 2 says it is orthogonal and optional.

## Classification (per-fork pass)

- **Layer** — Intent (declarative UX "what") + a composing Block, mirroring #1384's two forced ratifies
  (intent + block; no project). Not a Project (no orchestration domain). The serialized tree *might* be a
  Protocol — that is Fork 2.
- **Composition seam** — `dockable` composes the shipped `resizable` splitter
  (we:src/_data/intents/resizable.json), the `tabs` block (we:src/_data/blocks/tabs.json), and the #1384
  Pointer-Events + reorder grab/move/drop substrate (we:src/_data/blocks/reorderable-list.json); it adds no
  new gesture.
- **Fixed mechanics (baked, inherited from #1384)** — APG Window Splitter on the splitters, APG Tabs on the
  stacks, live-region announce on drag-to-dock, Pointer Events substrate (never HTML DnD),
  `Element.moveBefore()` progressive relocation. Pointer-only is the broken branch.
- **Resolution / default** — most-permissive: docking is opt-in per surface; absent → a static (non-dockable)
  layout.
- **Native-first** — gesture (Pointer Events), partition rendering (CSS Grid/Flex), popout (`window.open`)
  are native; the standard adds the recursive container model + drag-to-dock semantics + the composed a11y
  contract the platform lacks (no native docking element, no proposal in flight).
- **Minimize lock-in** — the serialized layout tree is the single escapable lock surface (Fork 2); everything
  else is composition, removable adapters, or native substrate.

## References

- Incumbent libraries: dockview, golden-layout, FlexLayout (caplin), rc-dock, lumino/PhosphorJS
  (JupyterLab docking), Theia / VS Code layout. Serialization: dockview `api.toJSON()`/`api.fromJSON()`,
  FlexLayout `Model.fromJson()`/`model.toJson()` — both a `row→column→stack-of-tabs` tree.
- Native substrate: MDN (`Element.moveBefore`, Pointer Events, CSS Grid, `window.open` +
  `adoptedStyleSheets`); W3C WAI-ARIA APG (Window Splitter + Tabs patterns exist; **no docking pattern**);
  Open UI / WHATWG (confirmed: no native docking / split-view / tab-stack element proposal in flight).
- WE tree: we:src/_data/intents/resizable.json, we:src/_data/intents/arrangeable.json,
  we:src/_data/intents/layout.json, we:src/_data/blocks/tabs.json, we:src/_data/blocks/reorderable-list.json;
  parent decision #1384 (we:backlog/1384-spatial-manipulation-arrangeable-surfaces-resizable-splitter.md);
  precedents #022, #409; codified rule we:docs/agent/platform-decisions.md (#project-protocol-bar,
  #compose-intent-dont-duplicate).
