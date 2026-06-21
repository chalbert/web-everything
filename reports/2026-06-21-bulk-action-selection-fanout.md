# Bulk actions over a multi-selection — placement survey

Prior-art survey grounding decision [#1423](/backlog/1423-bulk-actions-over-a-multi-selection-selection-action-bar-bat/)
(surfaced by the production-app teardown lens [#1404](/backlog/1404-discovery-lens-production-app-teardown-inventory-real-apps-d/), Linear walk).
Per design-first step 1, prior art is gathered before the forks are framed so the dimensions reuse
platform vocabulary.

## The concern

Selecting several rows reveals a **contextual action bar** offering operations applied to the **whole
selection** (move, assign, label, delete), with select-all / clear-selection affordances and an a11y
announcement of "N selected". Recurs across Gmail, Linear, Google Drive, Notion, file managers. WE owns the
pieces but not the composition: `selection` models the *choice*, `command`/`action` model a *single*
invocation. The card asks: a `bulk-action` intent composing `selection` + `command`, vs a `selection`
extension, vs a headless behavior.

## Native grounding

The whole batch-apply surface decomposes onto native/ARIA primitives:

- **"N selected" announcement → ARIA live region** (`aria-live="polite"` / `role="status"`; `polite`, must
  not interrupt).
- **The action bar → `role="toolbar"`** (a contextual bar of grouped controls — the APG Toolbar pattern,
  one tab stop, roving tabindex; WE already owns this).
- **Select-all header → tri-state checkbox `aria-checked="mixed"`** (some-but-not-all → `mixed`; click on
  mixed → select all, click again → clear).
- **The selectable set → listbox/grid multi-select** (`aria-multiselectable` + per-item `aria-selected` —
  what `SelectionBehavior` already projects).
- **Post-action focus return** is a managed-focus concern (focus-delegation), not a new primitive.

## Finding 1 (load-bearing) — Polaris AND Carbon ship bulk-actions as a first-class, NAMED API; the pattern recurs identically

The *composition* is the standardizable thing, not the pieces:

- **[Shopify Polaris](https://polaris-react.shopify.com/components/tables/index-table)** names it on
  IndexTable/ResourceList: `bulkActions` + `promotedBulkActions` (1–2 actions promoted out of the overflow
  menu, collapsing on narrow screens).
- **[IBM Carbon](https://carbondesignsystem.com/components/data-table/usage/)** names it
  `TableBatchActions` / `TableBatchAction` — a batch action bar that overlays the table toolbar the moment
  ≥1 row is selected, wired via `getBatchActionProps` exposing `selectedRows`, with a live count.

Two independent mature systems converged on a named "bulk/batch actions" concept bound to the selection
set — and it recurs identically across Gmail / Linear / Drive / Notion.

## Finding 2 — select-all is a two-scope concept: "all on this page" vs "select all N matching"

[Gmail's canonical pattern](https://support.google.com/mail/answer/7190): the header checkbox selects the
current page, then surfaces a distinct affordance "select all conversations that match this search" to
expand to the full result set. The two scopes exist deliberately (accident-protection + performance), so
the selection set a bulk action fans across may be *materialized rows* OR a *predicate over an unmaterialized
set*. [MUI X](https://mui.com/x/react-data-grid/row-selection/) encodes the same as
`checkboxSelectionVisibleOnly` and retains cross-page selections via `keepNonExistentRowsSelected` — the set
is not always a concrete id-list.

## Finding 3 — bulk actions are explicitly a composition over selection + toolbar, not a built-in

MUI X documents the recipe as "remove per-row actions, read `selectedRows` in a custom Toolbar" (bulk-action
support is a long-standing tracked feature, not a built-in). Ant Table `rowSelection` uses the same
`selectedRowKeys` + custom select-all `selections` shape. Canonical vocabulary: *bulk actions* (Polaris,
Gmail), *batch actions / batch action bar* (Carbon), *promoted actions* (Polaris), *contextual action bar*,
*select-all-visible vs select-all-matching*, *indeterminate / mixed*, *N selected*, *clear selection*.

## WE-tree decomposition

- **[we:src/_data/intents/selection.json](../src/_data/intents/selection.json)** owns *the choice*: `model:
  single | multiple`, `immediacy`, `variant`, `grouping`. It does **not** model applying an operation to
  the chosen set.
- **[we:src/_data/blocks/selection.json](../src/_data/blocks/selection.json)** (`SelectionBehavior`) owns
  multi-select mechanics + `aria-multiselectable` — the *input* to a bulk action, not the action surface.
- **[we:src/_data/intents/command.json](../src/_data/intents/command.json)** owns *a single invocation*
  (`id`, `label`, `binding`, grounded on the Invoker Commands API — one control, one `CommandEvent`). It
  does **not** fan across N targets.
- **The action-bar container is already homed:** [we:src/_data/assemblerPresets/toolbar.json](../src/_data/assemblerPresets/toolbar.json)
  + `focus-delegation` + `composite-widget` (the #1409 toolbar placement). So the *bar* is not the residual.

**The precise unowned residual** — the **batch-apply binding/semantics**, owned by neither selection (the
choice) nor command (single invoke) nor toolbar (the container): (1) **fan-out** — apply one `command`
across the live selection set's N targets, accepting the set as an id-set OR a select-all-matching
predicate/exclusion-set; (2) **select-all scope** — `visible` vs `matching` + the `mixed` header control +
clear; (3) the **"N selected"** `aria-live="polite"` readout bound to `selection-change`; (4) **post-action
focus return** after the set empties; (5) (optional) promoted-vs-overflow partitioning.

## Recommended placement

- **Fork 1 — home:** a thin **`bulk-action` intent composing `selection` + `command` over a target set**
  (~85%), realized by a FUI behavior block. The **`selection` extension/trait** branch is broken — it would
  force `selection` (the choice) to own `command` fan-out, contradicting its scope and the
  command-orthogonality `we:src/_data/intents/command.json` asserts (selection must not depend on command). A **headless behavior
  with no intent** is broken as the *sole* home — WE owns contracts; the recurring named pattern wouldn't be
  a WE standard at all (it is correct only as the *impl half* of the intent). The concern recurs
  independently (Polaris/Carbon name it; Gmail/Linear/Drive/Notion repeat it) and owns net-new semantics
  (fan-out + select-all-matching predicate + count contract) — clearing the bar for an intent, not a mere
  recipe. Residual (~15%): could be expressed as an `assemblerPreset` beside `we:src/_data/assemblerPresets/toolbar.json`, but the net-new
  semantics argue for a first-class intent.
- **Fork 2 — select-all model:** expose a `scope: visible | matching` dimension, default **`visible`**
  (~80%), with `matching` carrying a predicate/exclusion-set rather than an id-list. Mandating one is broken
  (both ship deliberately — most-flexible-default); `visible` is the safe/accident-protected default,
  `matching` the author opt-in.

Supported by default: "N selected" via `aria-live="polite"`; indeterminate header = `aria-checked="mixed"`;
multi-select input reuses `SelectionBehavior`; the bar reuses the existing toolbar (bulk-action *binds* the
bar to the selection set, doesn't own the bar); each bar action is a `command` invocation that bulk-action
fans; post-action focus return = a focus-delegation concern.

Seams: **selection** (the choice; one-way dependency bulk-action → selection; selection stays oblivious to
commands) · **command** (single invoke; bulk-action's net-new verb is *fan-out*) · **#1409 toolbar** (the
bar container; bulk-action owns the *binding* of the bar to the live selection + the batch semantics) · **a
future #1395-style optimistic mutation** (a batch of N mutations; bulk-action *names* the partial-failure
outcome contract per-target and *delegates* apply/rollback — don't duplicate it).
