---
kind: decision
parent: "099"
size: 5
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
preparedDate: "2026-06-21"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#compose-intent-dont-duplicate"
tags: [decision, book-candidate, spatial-manipulation, resize, snap, dashboard, layout, reorder-intent, gap]
relatedReport: reports/2026-06-21-spatial-manipulation-arrangeable-surfaces.md
crossRef: { url: /research/spatial-manipulation-arrangeable-surfaces/, label: "Prep survey — spatial manipulation / arrangeable surfaces" }
---

# Decision — Spatial manipulation / arrangeable surfaces (resizable splitter, snap-to-grid, draggable dashboard): placement & decomposition

**Prepared 2026-06-21 — ready to ratify.** No design exists yet for user-driven spatial manipulation
(grab an edge to resize a pane, snap to a grid / alignment points, drag widgets on a dashboard). The forks
below are grounded in a prior-art survey published as
[`/research/spatial-manipulation-arrangeable-surfaces/`](/research/spatial-manipulation-arrangeable-surfaces/)
(report linked via `relatedReport`). The survey **reshaped** the original five-concern sketch into **two
forced ratifies** (placement layer; keyboard-a11y + Pointer-Events substrate as a fixed mechanic) **+ four
genuine forks**, each with a **bold** default. Like [#022](/backlog/022-drag-and-drop-paradigms/) (one
decision → `reorder` intent + `reorderable-list` block + traits), the expectation is a **fan-out** of
intents/blocks, not a pre-minted set; realizing builds are deferred via a `blockedBy` chain at ratification.

## Ruling (ratified 2026-06-21)

**All four forks resolved to their prepared defaults; both forced ratifies stand. Red-teamed inline —
no default fell, and the principle-violation check (impl-is-not-a-standard, bias-toward-separation,
dimension-vs-fixed-mechanic, fork-is-not-prioritization) *supports* every default rather than catching
one.** Placement/decomposition only — the realizing builds are deferred via the `blockedBy` chain below
(the [#022](/backlog/022-drag-and-drop-paradigms/) / #064 fan-out shape).

- **Forced ratify A — intent(s) + composing block(s); no project, no protocol.** No provider seam, no
  interchange schema ([we:docs/agent/platform-decisions.md#project-protocol-bar](../docs/agent/platform-decisions.md#project-protocol-bar));
  precedents [#409](/backlog/409-decision-master-detail-intent-vs-project/) / [#467](/backlog/467-responsive-container-query-layout-placement-new-project-vs-i/). The "new project" branch is broken.
- **Forced ratify B — keyboard-a11y + Pointer-Events as a fixed mechanic, not a dimension.** APG Window
  Splitter (resize), APG Grid (2-D arrange), live-region announce, `Element.moveBefore()` (progressive,
  `insertBefore` fallback); never HTML DnD. Pointer-only is the broken branch (violates the `reorder`
  keyboard-parity contract). Holds under any value of the forks.

- **Fork 1 → A: standalone `resizable` (splitter) intent**; `layout.pane` composes it. *(~80%.)* The
  divider recurs **without** the app-shell (split editor, inspector pane, master-detail seam), so the
  reusable axis earns its own home; `layout` is a `concept`-status *structural* region intent, and
  folding an interaction mechanic into it is the category smell (bias-toward-separation,
  [#compose-intent-dont-duplicate](../docs/agent/platform-decisions.md#compose-intent-dont-duplicate)).
  *(B — complete `layout.pane` with the divider — rejected: locks the splitter to the shell framing.)*
- **Fork 2 → A: new `arrangeable` intent composing reorder's substrate** *(cleanest fork, ~90%)*.
  `reorder` contracts *"order of a collection"* (1-D index, [we:src/_data/intents/reorder.json:5](../src/_data/intents/reorder.json));
  a dashboard item is an `{x,y,w,h}` *position*. `arrangeable` owns the 2-D model (grid coords,
  collision/compaction, resize) and **reuses** reorderable-list's shipped Pointer/keyboard/live-region/
  `moveBefore()` mechanics. *(B — extend `reorder` with a 2-D dimension — rejected: overloads its
  contract with resize + coordinates + compaction, three concerns it never named.)*
- **Fork 3 → A: split.** Grid-snap is a **dimension of `arrangeable`** (it falls out of the grid's cell
  coordinate system — no separate entity); **magnetic alignment is a standalone `alignment-guides`
  intent** (peer-relative, guide lines, threshold; needs no grid). *(~80%.)* *(B — one unified `snap`
  intent — rejected: forces a grid concept onto magnetic alignment and a peer-reference concept onto
  grid-snap; would falsely pull in `scroll-snap` paging — [#decompose-overloaded-vocabulary-by-semantic-source](../docs/agent/platform-decisions.md#decompose-overloaded-vocabulary-by-semantic-source).)*
- **Fork 4 → A: carve docking/tiling to its own future decision**, flagged same-family,
  `blockedBy` this one for the shared substrate + a11y baseline. *(~75%.)* The recursive partition-tree
  (golden-layout / dockview / FlexLayout) is a genuinely distinct heavyweight third model; the carve is a
  real contract boundary, not prioritization-in-fork's-clothing. *(B — fold a `dockable` intent in now —
  rejected: widens this call to a distinct contract with fewer immediate consumers.)*

*Residual (the one judgment call):* the decomposition mints **3 new intents** (`resizable`,
`arrangeable`, `alignment-guides`) + carves a 4th decision (`dockable`) — wider than #022's 1-intent
fan-out. Held because each is independently reusable without the others (a splitter with no grid; Figma
guides with no grid; a dashboard with no guides), so they are three concepts, not slices of one.

### Graduation chain filed at resolution (`blockedBy: 1384`)
- [#1434](/backlog/1434-resizable-splitter-intent-spec-mint-we-src-data-intents-resi/) — `resizable`
  (splitter) intent spec *(Fork 1)*.
- [#1435](/backlog/1435-arrangeable-intent-spec-mint-we-src-data-intents-arrangeable/) — `arrangeable`
  intent spec, composing reorder's substrate; grid-snap as a dimension *(Fork 2 + Fork 3 grid-snap)*.
- [#1436](/backlog/1436-alignment-guides-intent-spec-mint-we-src-data-intents-alignm/) —
  `alignment-guides` intent spec *(Fork 3 magnetic)*.
- [#1437](/backlog/1437-decision-docking-tiling-dockable-window-management-placement/) — follow-on
  **decision**: docking / tiling (`dockable`) placement *(Fork 4 carve-out)*.

## The axes the survey surfaced

The survey found there is **no single "spatial manipulation"** — it decomposes onto orthogonal axes, each
pinned to the real tree:

- **Three irreducible layout models**, with incompatible state shapes & mechanics that do not unify into one
  contract: **linear split** (a divider position, resize-only, sibling-reflow), **flat 2-D grid** (a flat
  `Array<{i,x,y,w,h}>`, drag + resize + collision/compaction), **recursive partition tree** (docking/tiling).
  Inside each model drag + resize + collision + serialization cluster tightly.
- **`reorder` is the adjacent 1-D substrate** — [we:src/_data/intents/reorder.json:5](../src/_data/intents/reorder.json)
  contracts *"user-mutable **order** of a collection"* (1-D sequence), with a `scope: within-list | cross-list`
  dimension ([we:src/_data/intents/reorder.json:36-42](../src/_data/intents/reorder.json)) and a
  Pointer-Events + keyboard + live-region + `Element.moveBefore()` substrate already shipped in
  [we:src/_data/blocks/reorderable-list.json](../src/_data/blocks/reorderable-list.json). 2-D placement is a
  *generalization* of this, but past its "order of a collection" contract.
- **`layout` already names but does not build the splitter** — [we:src/_data/intents/layout.json:24](../src/_data/intents/layout.json)
  declares `pane` as *"a resizable subdivision of the shell"* with **no divider mechanic**.
- **Snap is two things** — grid-snap (emergent from a grid's cells) vs magnetic alignment (standalone,
  peer-relative guide lines); `scroll-snap` (Carousel's substrate,
  [we:src/_data/blocks/carousel.json:6](../src/_data/blocks/carousel.json)) is a third, unrelated paging
  mechanism.
- **Native substrate is partial** — gesture (Pointer Events + `setPointerCapture`), layout (CSS Grid),
  observation (`ResizeObserver`) are Baseline; the *interaction semantics* (splitter resize, snap-to-cell
  drag, dashboard arrange + accessible keyboard) have **no native primitive and no Open UI/CSSWG proposal in
  flight**. CSS `resize` is Limited & structurally not a splitter; HTML DnD is disqualified (a11y dead-end);
  `Element.moveBefore()` + Anchor Positioning are progressive (not yet Baseline).

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 — Resize home** | Standalone `resizable` intent; `layout.pane` composes it | Extend `layout` (pane gains the divider) | med-high |
| **2 — 2-D arrange & reorder** | New `arrangeable` intent **composing** reorder's substrate | Extend `reorder` with a 2-D placement dimension | high |
| **3 — Snap decomposition** | Split: grid-snap = `arrangeable` dimension + standalone `alignment-guides` intent | One unified `snap` intent | med-high |
| **4 — Docking / tiling scope** | Carve to its own future decision (same family, distinct model) | Fold in now as a `dockable` intent | med |

## Forced ratifies (not forks — stated for the record)

- **Placement layer → intent(s) + composing block(s); no project, no protocol.** Codified by
  [we:docs/agent/platform-decisions.md](../docs/agent/platform-decisions.md) (#project-protocol-bar — "not
  every gap is a Project/Protocol"; mint a protocol only for a provider seam / interchange schema, which
  spatial manipulation has neither) + precedents [#409](/backlog/409-decision-master-detail-intent-vs-project/)
  (master-detail → intent) and [#467](/backlog/467-responsive-container-query-layout-placement-new-project-vs-i/)
  (responsive-layout → extend intents). The "new project" branch is *broken* (no orchestration domain,
  no contract), so this is a ratify, not a weigh.
- **Keyboard / a11y + substrate → fixed mechanic, not a dimension.** Pointer Events + `setPointerCapture`
  (never HTML DnD); ARIA APG **Window Splitter** (`role="separator"` + `aria-valuenow/min/max` +
  arrows/Home/End) for resize; ARIA APG **Grid** pattern for 2-D arrange; live-region announce;
  `Element.moveBefore()` (progressive, `insertBefore` fallback) for state-preserving widget moves. Pointer-only
  is the *broken* branch — non-conforming, and it violates the `reorder` keyboard-parity contract. These hold
  under *any* value of the dimensions below, so they are baked.

## Fork 1 — Resize home: standalone `resizable` intent vs. extend `layout`

*Fork-existence:* both branches are coherent and **cannot coexist** — resize either gets its own intent or
becomes part of `layout`; the standard ships one shape. The excluded reading ("just document a pattern") is
broken (every consumer wires it identically → it earns a reusable home, per #409's Option C rejection).

`layout` already declares `pane` as *"a resizable subdivision of the shell"*
([we:src/_data/intents/layout.json:24](../src/_data/intents/layout.json)) but ships no divider, so the
splitter could *complete* `layout`. But a resizable divider recurs **without** the app-shell — a split code
editor, a preview/inspector pane inside any component, a master-detail seam — so the reusable axis earns its
own home.

- **A — Standalone `resizable` (splitter) intent** *(recommended)*. Models the linear-split divider
  (`role=separator`, min/max constraints, orientation, optional collapse-to-edge); `layout.pane` and any
  block compose it. Merit: bias-toward-separation (a concept that recurs without its neighbour earns its own
  home); a clean conformance target independent of the shell.
- **B — Extend `layout`** (pane gains the divider mechanic). Merit: keeps the shell's pane story whole.
  *Rejected* as the default — it locks the splitter to the app-shell framing when its natural scope is "any
  two adjacent regions," and `layout` is a `concept`-status region-anatomy intent, not an interaction intent.

## Fork 2 — 2-D arrangement & the `reorder` relationship

*Fork-existence:* both coherent, **cannot coexist** — either `reorder` absorbs 2-D placement or a separate
intent owns it; one contract shape ships. Overloading `reorder` and minting a sibling are mutually exclusive
designs for the same capability.

A draggable dashboard is `reorder` generalized from 1-D collection order to 2-D placement (+ resize + snap).
`reorder`'s contract is explicitly *"user-mutable **order** of a collection"*
([we:src/_data/intents/reorder.json:5](../src/_data/intents/reorder.json)) with a 1-D `scope` dimension
([we:src/_data/intents/reorder.json:36-42](../src/_data/intents/reorder.json)); a dashboard item has an
`{x,y,w,h}` *position*, not a sequence index.

- **A — New `arrangeable` intent that composes reorder's substrate** *(recommended)*. The new intent owns the
  2-D placement model (grid coords, collision/compaction, resize) and **reuses** reorder's already-shipped
  Pointer-Events + keyboard + live-region + `moveBefore()` mechanics
  ([we:src/_data/blocks/reorderable-list.json](../src/_data/blocks/reorderable-list.json)) rather than
  re-implementing them. Merit: keeps `reorder`'s contract crisp (1-D order stays 1-D); composition over
  overload; the survey's three-models finding says 2-D grid is a *distinct* model from list reorder.
- **B — Extend `reorder` with a `placement: list | grid-2d` (or `scope: grid-2d`) dimension.** Merit: one
  intent for "user moves things." *Rejected* — it stretches "order of a collection" to cover resize + 2-D
  coordinates + compaction, three concerns reorder's contract never named; its dimensions (`grab`, `commit`,
  `announce`) mean different things in 2-D. Overloading is the worse branch on intent-crispness grounds.

## Fork 3 — Snap decomposition: one `snap` intent vs. split

*Fork-existence:* both coherent, **cannot coexist** — snap is modeled either as one intent or as two separate
homes; the survey shows the two snap behaviors are *architecturally* separate (grid-snap is a property of a
grid's cells; magnetic alignment is peer-relative with guide lines and needs no grid), so a single intent
would conflate two unrelated mechanisms.

- **A — Split** *(recommended)*: grid-snap is a **dimension of `arrangeable`** (it falls out of the grid's
  cell coordinate system — no separate entity), and **magnetic alignment is a standalone `alignment-guides`
  intent** (peer-element reference, rendered guide lines, threshold; composes with both `resizable` and
  `arrangeable` and with free-canvas drag). Merit: bias-toward-separation; "having grid cells gives you no
  Figma guides; having Figma guides needs no grid."
- **B — One unified `snap` intent** covering both. *Rejected* — it forces a grid concept onto magnetic
  alignment (which needs none) and a peer-reference concept onto grid-snap (which has none), so the dimension
  set never coheres; `scroll-snap` paging would also get falsely pulled in.

## Fork 4 — Docking / tiling scope: in this decision or carved out?

*Fork-existence:* both coherent, **cannot coexist** in *this* item — docking is either decided here (as a
third model) or it is explicitly a separate future decision; the survey confirms docking is a genuinely
**distinct third layout model** (a recursive partition tree: golden-layout / dockview / FlexLayout / rc-dock),
not the same model as splitter or dashboard-grid.

- **A — Carve to its own future decision** *(recommended)*, flagged as the same *spatial-manipulation family*.
  Merit: the recursive-tree model is heavyweight (nested tab-stacks, popout-to-OS-window, tree serialization)
  and orthogonal to the split/grid models this item decides; folding it in widens the decision surface for a
  model with a distinct contract. File a follow-on `kind: decision` (a `dockable` / window-management intent)
  at ratification, `blockedBy` this one for the shared substrate + a11y baseline.
- **B — Fold in now** as a third `dockable` intent. *Rejected* as default — it widens this call to a model
  with a distinct contract and fewer immediate consumers; better decided once the splitter + arrange shapes
  are settled (this item is their prerequisite).

## What this is NOT

- Not a commitment to build — placement / decomposition only; the realizing blocks are deferred builds spun
  out via a `blockedBy` chain at ratification (the #022 / #064 fan-out shape).
- Not window-management / OS-style tiling (movable floating windows) — that is Fork 4's recursive-tree model,
  recommended **out of scope** for this item and carved to its own decision.

## Definition of Ready — met

- ✅ A `/research/` prep survey of the incumbents + the native-substrate Baseline check is published
  ([`/research/spatial-manipulation-arrangeable-surfaces/`](/research/spatial-manipulation-arrangeable-surfaces/),
  report linked via `relatedReport`).
- ✅ Each fork stated with options + a **bold** recommended default + confidence (in the glance table).
- ⬜ `preparedDate` stamped on release — see `/next decision` to ratify.
