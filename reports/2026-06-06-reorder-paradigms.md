# Reorder Paradigms — drag-and-drop decomposed into a UX intent + traits

**Point:** "Drag and drop" is not one component but two UX families — *reorder* (user-mutable order
of a collection) and *data transfer* (moving a payload between zones). This report codifies the
**reorder** family as a single UX intent (`reorder`) plus composable traits on a `reorderable-list`
block, leans on the shipped `Element.moveBefore()` substrate (`preserve-on-move`, [#084](/backlog/084-component-preserve-on-move/)),
and mandates keyboard parity as a non-optional part of the contract. The generic data-transfer
family stays the open call in [#007](/backlog/007-gap-11-clipboard-dnd-files-intents/).

## Why this exists

Reordering the backlog itself surfaced the need. Rather than build a one-off drag-and-drop widget,
we define the standard first — the same move as the droplist, where a "dropdown" turned out to be a
composition of paradigms, not a single component (see
[`reports/2026-06-02-droplist-trait-language.md`](2026-06-02-droplist-trait-language.md)).

## The split: reorder vs. data transfer

| Family | UX contract | Origin | Home |
|---|---|---|---|
| **Reorder** | The *order* of items in a collection is user-mutable; the item set is unchanged | reordering the backlog | **this report** → `reorder` intent + `reorderable-list` block |
| **Data transfer** | A *payload* (item, file) moves from a source into a zone that validates what it accepts | gap-11 DataTransfer primitives | [#007](/backlog/007-gap-11-clipboard-dnd-files-intents/) — Clipboard / DnD / Files |

They share the surface grammar (grab → move → drop) but differ in contract: reorder mutates a single
collection's order in place; data transfer carries a payload across a boundary and may copy, move, or
reject it. Modeling them separately keeps each intent's dimensions coherent. `reorder` is the focused,
agent-buildable slice; the broader drag-source / drop-target / accepts contract remains #007's open
"bundled vs. separate" decision, which can build on the trait grammar established here.

## Prior art

### Native substrate

| Substrate | Status | Role in reorder |
|---|---|---|
| [Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events) | Baseline | The real foundation — unifies mouse/touch/pen, supports `setPointerCapture`. The default pointer-drag path. |
| [`Element.moveBefore()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/moveBefore) | Baseline 2025 (progressive) | Atomic relocation that **preserves state** (focus, animations, iframes, custom-element connection) — exactly what reordering interactive cards needs. Wired declaratively via `preserve-on-move` ([#084](/backlog/084-component-preserve-on-move/)). |
| [HTML Drag and Drop API](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API) | Baseline | `draggable` + `dragstart/dragover/drop`. Ubiquitous but clunky, weak for touch and a11y. Reserved for **cross-window / file** transfer (a #007 concern), **not** the in-list reorder default. |
| `aria-grabbed` / `aria-dropeffect` | **Deprecated** | Do **not** use. The standard mandates the keyboard-reorder + live-region pattern instead (below). |

**Native-first decision:** the built-in reorder default is **Pointer Events + `Element.moveBefore()`**,
not the HTML5 Drag and Drop API. HTML5 DnD is opt-in only where its unique powers are required
(dragging files in from the OS, dragging across browser windows) — and those land under #007.

### Framework / library patterns

| Source | Patterns adopted |
|---|---|
| [dnd-kit](https://dndkit.com/) | Sensor abstraction (pointer/keyboard/touch as peer sensors); keyboard is a first-class sensor, not a bolt-on. Validates `movement` as a dimension. |
| [SortableJS](https://sortablejs.github.io/Sortable/) | `handle` option (scoped grab), cross-list groups, `onEnd` commit hook. Validates `grab` and `scope` dimensions. |
| [Atlassian Pragmatic drag-and-drop](https://atlassian.design/components/pragmatic-drag-and-drop/) | Built on native DnD with explicit a11y guidance; reorder announced via live region. |
| [Vue Draggable](https://github.com/SortableJS/vue.draggable.next) / [react-beautiful-dnd](https://github.com/atlassian/react-beautiful-dnd) | Order model as the source of truth; the DOM follows the array. Validates the order-model provider. |
| [WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/) | No `aria-grabbed`; recommends keyboard alternative + live-region announcement for any drag interaction. |

## Accessibility mandate (non-negotiable)

Keyboard-reorder is **part of the contract, not an add-on.** Any conforming reorderable list must
provide a keyboard path equivalent to the pointer path:

- **Roving tabindex** over the reorderable items (composes with the `focus-delegation` intent).
- **Move keys** — grab/drop (e.g. `Space`) then move (`ArrowUp`/`ArrowDown`), or a held modifier +
  arrows. (Exact keymap is an open point below.)
- **Live-region announcement** of each move and the final commit ("Moved item 3 to position 1 of 8"),
  composing with the `live-region-status` intent. This replaces the deprecated `aria-grabbed`/`aria-dropeffect`.

A reorderable list that ships pointer-drag without the keyboard path is **non-conforming**, not
"partially done."

## Feature inventory

| Paradigm | Disposition | Tier | Substrate / composition |
|---|---|---|---|
| reorderable-list (order model) | built-in | 1 | `Element.moveBefore()` via `preserve-on-move`; order-model provider |
| drag-handle (scoped grab) | built-in | 1 | Pointer Events; `withDragHandle` |
| keyboard-reorder (a11y parity) | built-in | 1 | roving tabindex + live region — **mandatory**; composes `focus-delegation` + `live-region-status` |
| pointer-reorder (drag movement) | built-in | 1 | Pointer Events + `setPointerCapture`; `withPointerReorder` |
| commit / persistence | provider | 2 | ephemeral / localStorage / write-back; `withCommitStrategy` |
| cross-list reorder | built-in | 2 | source/target group key; `withCrossListReorder` |
| manual order vs computed sort | compose | — | cross-ref `collection-operations` — reorder is *manual* order, distinct from its `sort` |
| file-drop / DataTransfer payload | defer | 3 | HTML5 DnD + File System Access → [#007](/backlog/007-gap-11-clipboard-dnd-files-intents/) |

## The `reorder` intent (UX dimensions)

| Dimension | Values | Default | Meaning |
|---|---|---|---|
| `grab` | `whole` · `handle` | `whole` | Whether the whole item is draggable or only a scoped handle affordance |
| `movement` | `pointer` · `keyboard` · `both` | `both` | Input modalities; **`both`** is the conformance baseline (keyboard is non-optional) |
| `commit` | `ephemeral` · `persisted` | `ephemeral` | Whether the new order is written somewhere durable or lives only for the session |
| `announce` | `none` · `live-region` | `live-region` | Move/commit announcement; `live-region` is the a11y baseline |
| `scope` | `within-list` · `cross-list` | `within-list` | Reorder inside one list, or move items between sibling lists |

Lifecycle events (high level): `reorder-start`, `reorder-move`, `reorder-commit`, `reorder-cancel`.

## Trait → dimension map (on the `reorderable-list` block)

| Trait | `intentDimension` |
|---|---|
| `withDragHandle` | `reorder.grab.handle` |
| `withPointerReorder` | `reorder.movement.pointer` |
| `withKeyboardReorder` | `reorder.movement.keyboard` |
| `withLiveAnnounce` | `reorder.announce.live-region` |
| `withCommitStrategy` | `reorder.commit.persisted` |
| `withCrossListReorder` | `reorder.scope.cross-list` |

## Composition map

- **`interaction`** (modality: pointer/touch) — reorder's pointer path is one application.
- **`focus-delegation`** (roving tabindex) — owns the active-item focus model the keyboard path drives.
- **`live-region-status`** — owns the announcement channel the `announce` dimension uses.
- **`collection-operations`** — its `sort` is a *computed* order; reorder is *manual* user-set order. They
  are mutually exclusive views of "what determines order"; cross-reference, do not merge.
- **`preserve-on-move`** ([#084](/backlog/084-component-preserve-on-move/)) — the atomic-move substrate; a reorderable item card sets `preserve-on-move` so a relocation keeps its focus/animation/connection state.

## Open points register

- 🔶 **DECIDE — keyboard keymap.** Grab-then-move (`Space` to lift, arrows to move, `Space`/`Enter` to
  drop, `Esc` to cancel) vs. held-modifier+arrows. Recommendation: **grab-then-move** (matches APG drag
  guidance and dnd-kit's keyboard sensor). Tracked for the block's conformance demo.
- 🔶 **DECIDE — commit-strategy provider shape.** Mirror the validation block's `CommitmentPolicy`
  registry (a `CustomReorderCommitRegistry` of providers) vs. a simpler attribute (`commit="persist"`).
  Recommendation: start with the **attribute** (`ephemeral` default; `persisted` writes back via an
  event the host handles), promote to a registry only if multiple persistence backends emerge.
- 🔨 **ROUGH — drop-position indicator.** The visual gap/placeholder during a drag is a styling-hook
  concern; spec the hook (`[data-reorder-target]`), leave visuals to the implementation.
- ⚠ **RECONCILE — #007 boundary.** When #007 settles the data-transfer family, confirm `reorder`
  composes cleanly with a future `drag-source`/`drop-target` rather than overlapping it (cross-list
  reorder is the seam — it is "move" semantics within the app, not OS-level DataTransfer).

## Next steps

1. `reorder` intent in `intents.json` (done in this pass).
2. `reorderable-list` block + traits in `blocks.json` + `block-descriptions/reorderable-list.njk` (done).
3. Semantics terms (done).
4. Cross-reference #007 and #084; mirror this report from #022 via `relatedReport` (done).
5. Implementation + fixture-driven conformance demo (keyboard-reorder is the headline case) — a future
   build item once the spec settles.
