# Edit-in-place / inline-edit lifecycle — placement survey

Prior-art survey grounding decision [#1397](/backlog/1397-in-place-inline-edit-edit-in-place-editable-cell-standard-pl/)
(surfaced by the verb-axis lens [#1390](/backlog/1390-interaction-paradigm-inventory-verb-axis-gap-lens-find-missi/)).
Per design-first step 1, prior art is gathered before the forks are framed so the dimensions reuse
platform vocabulary.

## The concern

Turn a *displayed value* into an *editor in place* and back: click-to-edit field, editable table cell,
rename-in-tree. The recurring lifecycle is

1. **display** — the value is rendered read-only (text, a cell, a tree label);
2. **activate** — a gesture (click / dblclick / Enter / F2) swaps the display renderer for an editor;
3. **edit** — the user types into the editor (an `input`, a select, a rich-text surface);
4. **commit** (blur / Enter → write the new value back, return to display) **or cancel** (Esc → discard,
   restore the *baseline* value, return to display).

WE owns the editor (`input`), the gate (`validation`), flowed-content editing (`rich-text`), and a
`data-grid` block — but **none owns the display→edit→commit/cancel lifecycle** as a reusable concern.

## Finding 1 — the lifecycle is a named, cross-component primitive (recurs *without* a grid)

Three major systems ship it as a **standalone** component, independent of any table/grid:

| System | Primitive | Shape |
| --- | --- | --- |
| Atlassian Design System | [`@atlaskit/inline-edit`](https://atlassian.design/components/inline-edit/) | `readView` / `editView` render props; `onConfirm` commit; starts in `readView`, click to edit; `keepEditViewOpenOnBlur`; commit on blur/Enter, cancel on Esc |
| PrimeReact | [`Inplace`](https://primereact.org/inplace/) | `InplaceDisplay` (read) / `InplaceContent` (edit) children; click display → edit mode; `closable` returns to read; controlled via `active`/`onToggle` |
| Ant Design | [`Typography` `editable`](https://ant.design/components/typography/) | `editable` config: `triggerType` (icon/text), `onChange`/`onStart`/`onCancel`/`onEnd`, `enterIcon`, `maxLength` |

That the same display⇄edit⇄commit lifecycle appears as a **first-class standalone primitive** — and recurs
again in **rename-in-tree** (Ant Tree custom-title editing; the APG treegrid) with no grid in sight — is
the load-bearing finding: the lifecycle is **not** a property of a grid. Folding it into `data-grid`
would force a standalone field or a tree-node rename to depend on a grid block.

## Finding 2 — the keyboard + a11y model is already platform-standard (APG Grid editing)

The [WAI-ARIA APG Grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) documents the in-place
editing keyboard model verbatim, and it is the same model the standalone primitives use:

- **Enter / F2** on a cell with editable content puts focus into the editor (textbox/widget); **F2 again**
  restores navigation.
- **Escape** restores grid navigation **and, if content was being edited, undoes the edit** — i.e.
  cancel reverts to the **baseline**.
- **`aria-readonly`** marks cells (or the whole grid) where editing is disabled.

So the *activation gesture* and the *commit/cancel-revert* semantics are W3C-specified vocabulary, not
something WE should re-mint. The intent should adopt them, not redefine them (native-first).

## Finding 3 — grids expose it as a *feature that composes the same lifecycle*, with edit modes

[MUI X DataGrid](https://mui.com/x/react-data-grid/editing/persistence/) has `cell` and `row` edit modes,
a `processRowUpdate` commit hook, and **Esc rolls back the cell value** (revert-to-baseline again);
[AG Grid] exposes `editable` columns + cell editors. This is the grid *consuming* the lifecycle per cell,
which is exactly the relationship `we:data-grid.json` already anticipates — it lists "editable cells" as a
competing implementation that registers against its contract, and its demo title reads "APG grid
navigation + editable cells", but it **defines no edit lifecycle of its own** (verified:
[we:src/_data/blocks/data-grid.json](../src/_data/blocks/data-grid.json) `designDecisions.contractsOnly`
names the seams as the *movement engine* and *active-cell projection* — editing is explicitly an external
impl that "registers against them without changing the contract"). So **`data-grid` does not already
cover the lifecycle** (the card's prep question), and it is the natural *first consumer* of the intent.

## What is genuinely new vs. already-owned

Decomposing the lifecycle against the existing intents:

| Lifecycle element | Already owned by | New? |
| --- | --- | --- |
| The editor control (text/number/select) | `input` (+ `rich-text` for flowed content) | no — compose |
| Gating the commit on validity; `aria-invalid`, commit policy | `validation` (`commitment` full/deferred, `execution` change/blur/submit) | no — compose |
| Cell focus / roving tabindex (grid case) | `focus-delegation` | no — compose |
| **Activation gesture** (click/dblclick/Enter/F2 → enter edit) | — | **yes** |
| **Display-renderer ⇄ editor-renderer swap for one bound value** | (`rich-text` does this for *flowed* content via `mode`; `disclosure` swaps *visibility*, not *renderer*) | **yes (for atomic values)** |
| **Cancel-reverts-to-baseline** (Esc restores the pre-edit value) | — (validation `deferred` buffers, but does not own revert-to-baseline or the dual-renderer) | **yes** |

The residual that nothing owns — *activation gesture + dual-renderer mode-swap + commit/cancel-revert for
an atomic value* — is small, recurring, and unowned. That is precisely the shape that earns a thin
cross-cutting intent (the [#596 accessible-name precedent](/intents/accessible-name/): own the thin
recurring policy, compose/defer everything the platform or a neighbour already standardizes).

## Seam vs. rich-text (so the two intents don't overlap)

[`rich-text`](/intents/rich-text/) already has a `mode: editable | read-only` dimension — but it governs
a **flowed, formatted content surface** (paragraphs, block elements, a document model). Edit-in-place
governs an **atomic scalar value** (a field, a number, a cell, a label) that swaps to *one* editor
control. They compose rather than overlap: an edit-in-place field *may* choose a `rich-text` surface as
its editor, but the lifecycle (activate→commit/cancel) is the same whether the editor is an `<input>` or
a rich-text surface. The seam is **content shape**: flowed document → rich-text; atomic value →
edit-in-place.

## Recommendation (to ratify in #1397)

1. **Mint a dedicated `edit-in-place` intent** (Fork 1; ~80%). The lifecycle recurs in ≥3 loci *without*
   a grid (standalone field, editable cell, tree-node rename) — a concept that recurs without its
   neighbour earns its own home (separate-and-decouple). Excluded branch: *data-grid feature only* is
   broken because it forces non-grid consumers onto a grid.
2. **Own only the thin residual; compose the rest** (Fork 2; ~85%). The intent owns *activation gesture*
   + *display⇄edit renderer swap* + *commit/cancel-revert lifecycle* (adopting APG's Enter/F2/Esc
   vocabulary), and **composes** `input` (editor), `validation` (commit gate), `focus-delegation` (cell
   focus), optionally `rich-text` (flowed editor). Excluded branch: re-owning text entry or validation =
   duplication/drift of shipped standards (native-first).
3. **Supported by default** (no fork): the WE *intent* (contract) and a FUI *behavior block* (realization)
   coexist at different layers — the "own intent vs behavior" framing is not an either/or (precedent:
   `data-transfer`/`reorder`/`selection` each ship an intent + a realizing block). `data-grid` composes
   the intent for editable cells; `rich-text` keeps its `mode` axis for flowed content.

## Dimensions the intent would own (draft, for the realizing build)

- `activation`: `click` | `dblclick` | `affordance` (an explicit edit button/icon) | `programmatic` —
  most-permissive default is the union the consumer picks; a sensible single default is `click` for
  fields, `dblclick`/`F2` for cells (APG).
- `commitOn`: `blur` | `enter` | `explicit` (Ok button) — composes with `validation.execution`.
- `cancelOn`: `escape` (revert to baseline) — adopted from APG, effectively fixed.
- `editor`: which editor the edit view renders (`input` | `rich-text` | custom) — a composition pointer,
  not a new mechanism.

These are draft inputs for the *realizing* item, not part of the placement ruling.
