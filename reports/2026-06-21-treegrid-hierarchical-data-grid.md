# Treegrid — hierarchical interactive data grid placement survey

Prior-art survey grounding decision [#1411](/backlog/1411-treegrid-hierarchical-interactive-data-grid-standard-placeme/)
(surfaced by the ARIA-APG lens [#1400](/backlog/1400-discovery-lens-aria-authoring-practices-apg-pattern-diff-aga/)).
Per design-first step 1, prior art is gathered before the forks are framed so the dimensions reuse
platform vocabulary.

## The concern

A **treegrid** is a 2-D grid whose rows form an expand/collapse hierarchy (file explorers, grouped data
tables, nested org views) — the APG Treegrid pattern, with 2-D arrow navigation **plus** row
expand/collapse. WE has `data-grid` (2-D grid nav) and `tree-select` (hierarchy) but no standard for their
combination. The card asks: composition (document the pattern), a `data-grid` dimension (`hierarchy:
true`), or its own block — and flags this as the **lowest-confidence APG-harvest item**.

## Native grounding

[WAI-ARIA APG Treegrid](https://www.w3.org/WAI/ARIA/apg/patterns/treegrid/): `role="treegrid"` over
`role="row"` rows; parent rows carry **`aria-expanded`** (omitted on leaves), `aria-level` (1-based depth),
`aria-posinset`/`aria-setsize`. Keyboard model = the **union** of two WE already owns: **Right** expands a
collapsed parent row *or* moves a cell right; **Left** collapses *or* moves a cell left; **Up/Down** move
across visible rows/cells and never change expand state. APG ships treegrid as its **own pattern** because
it "combines characteristics of both tree and grid" — but that is an a11y-*role* distinction, **not**
evidence it must be a distinct *block*.

## Finding 1 (load-bearing) — industry treats treegrid as a grid MODE/feature, not a separate component

The dominant grids all express hierarchy as a *feature toggled by data shape*, reusing the grid's full
feature set:

- **AG Grid** — "Tree Data" + row grouping are *modes of the grid* (`getDataPath` / group columns); no
  separate TreeGrid component.
- **[MUI X DataGrid](https://mui.com/x/react-data-grid/tree-data/)** — `treeData` + `getTreeDataPath` and
  row grouping are **props** on the same DataGridPro, not a new component.
- **TanStack Table** — expansion is `expanded` state + `getSubRows` / `getExpandedRowModel` on the one
  headless table model; sub-rows are a row-model feature.

The **counter-example: PrimeReact [TreeTable](https://primereact.org/treetable/)** is a *distinct*
component from DataTable — but the split is driven by **input data shape** (`TreeNode[]` vs flat rows), an
impl/tooling convenience, not a different a11y contract (impl-is-not-a-standard). React Aria likewise
exposes expandable rows on its Table; Lightning `tree-grid` is a grid variant.

## Finding 2 — canonical vocabulary

`treegrid` (the a11y role), **tree data** / **sub-rows** / **expandable rows** (the data shape), **row
grouping** (the aggregation variant), **expander/toggler column**, and the ARIA terms `aria-level` /
`aria-expanded` / `aria-posinset` / `aria-setsize` — all of which WE already owns via the `hierarchy`
intent. The new surface vocabulary is "tree data / sub-rows" as a *projection of data-grid*.

## WE-tree decomposition — the two halves are already owned

- **[we:src/_data/blocks/data-grid.json](../src/_data/blocks/data-grid.json)** owns the 2-D half and is
  **contractsOnly**: its `contractsOnly` decision names "the movement engine, the active-cell projection"
  as the seams against which "competing implementations (virtualized rows, editable cells, server paging,
  two-dimensional selection) register against them without changing the contract." It composes
  Focus-Delegation with orientation `both`. It does **not** anticipate hierarchy/row-grouping anywhere
  (`aria-rowcount`/`aria-rowindex` only) — the row-disclosure half is genuinely unowned by data-grid.
- **[we:src/_data/intents/hierarchy.json](../src/_data/intents/hierarchy.json)** already owns the
  disclosure/hierarchy half **and explicitly names treegrid as a composer** — its summary: "Tree-select,
  **treegrid**, and nested menus compose this one intent." It owns `aria-level`/`setsize`/`posinset`, the
  Right/Left expand-then-descend / collapse-then-ascend traversal, and **the flatten-to-visible-rows
  projection** ("Windowed Collection needs zero tree-specific changes"); collapse-focuses-ancestor keeps
  focus in the projection. [we:src/_data/blocks/tree-select.json](../src/_data/blocks/tree-select.json)
  realizes it as a 1-D droplist member.

**The unowned residual:** *nobody owns the composition itself* — a 2-D grid whose **rows are the
hierarchy's flattened-visible projection** and whose **Right/Left arbitrates row-disclosure vs
cell-movement** (collapsed parent row + Right = expand; otherwise = move cell). That arbitration rule + the
"rows = flatten-to-visible projection feeding the grid's row axis" wiring is the only genuinely new
contract — small, and a *projection over two existing seams*, not a new engine.

## Recommended placement

- **Fork 1 — is treegrid a new block?** Default: **a `hierarchy` projection/dimension on `data-grid`**
  (~70%) — data-grid's row axis is fed by the hierarchy intent's flatten-to-visible-rows projection, rows
  carry `aria-level`/`aria-expanded`, and the movement-engine seam gains the Right/Left
  disclosure-vs-cell arbitration rule (adds `role="treegrid"` + `composesIntents: [..., "hierarchy"]`; no
  new block). The **own-block** branch is broken/over-minting — it would re-mint a 2-D nav engine data-grid
  already owns (contractsOnly) and re-derive hierarchy the `hierarchy` intent already owns *and names
  treegrid as a composer of* (PrimeReact's separate TreeTable is a data-shape tooling convenience, not a
  standards necessity). The **doc-only composition** branch under-delivers: the Right/Left arbitration rule
  is a real contract delta needing a named home + conformance vector, not just prose — it is the fallback
  only if authoring shows zero contract change. Honest residual: this is the lowest-confidence APG-harvest
  item; the (a)/(b) line is thin and resolves at authoring time; own-block (c) is firmly out (~90%).
- **Fork 2 — is "row grouping" the same surface as "tree data"?** Likely **not a fork** (support-both):
  tree-data (intrinsic hierarchy) and row-grouping (grouping flat rows by a column value) are two *data
  adapters* onto the one `hierarchy` projection (both produce a flatten-to-visible projection with
  `aria-level`/`aria-expanded`), not two contracts. One projection, two author-facing shapes.

Supported by default: native `role="treegrid"` + the ARIA hierarchy attributes (already WE vocabulary via
the `hierarchy` intent); the APG Right/Left dual semantics (already in `we:src/_data/intents/hierarchy.json`; treegrid only adds
the cell-movement fallback when the row isn't a collapsible parent); the flatten-to-visible projection
(already owned); focus via data-grid's Focus-Delegation seam (orientation `both`); selection delegated to
the Selection intent, independent of disclosure.

Seams: **data-grid** owns 2-D cell navigation + the movement/active-cell seams (flat row axis only);
**hierarchy/tree-select** owns nesting + disclosure + the flatten projection (1-D); **treegrid** owns only
the new residual — rows = the hierarchy projection feeding data-grid's row axis + the Right/Left
arbitration rule — surfaced as data-grid's `hierarchy` projection, not a third engine.
