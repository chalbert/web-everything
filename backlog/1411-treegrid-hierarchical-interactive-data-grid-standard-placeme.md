---
kind: decision
size: 3
parent: "099"
status: open
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
tags: [decision, book-candidate, treegrid, data-grid, tree, apg, gap]
relatedReport: reports/2026-06-21-treegrid-hierarchical-data-grid.md
preparedDate: "2026-06-21"
---

# Treegrid — hierarchical interactive data grid standard: placement

Surfaced by the ARIA-APG lens ([#1400](/backlog/1400-discovery-lens-aria-authoring-practices-apg-pattern-diff-aga/)):
a **treegrid** is a 2-D grid whose rows form an expand/collapse hierarchy (file explorers, grouped data
tables, nested org views) — the APG Treegrid pattern, with 2-D arrow navigation plus row expand/collapse
([prior-art survey](/research/treegrid-hierarchical-data-grid/)). WE has `data-grid` (2-D grid nav) and
`tree-select` (hierarchy) but no standard for their combination.

The axis the prep pins to the real tree: **both halves are already owned, and the composition is the only
unowned residual.** [we:src/_data/blocks/data-grid.json](../src/_data/blocks/data-grid.json) is
`contractsOnly` — its decision names "the movement engine, the active-cell projection" as the seams against
which "competing implementations (virtualized rows, editable cells, server paging, two-dimensional
selection) register against them without changing the contract" — but it has a *flat* row axis (no
hierarchy). [we:src/_data/intents/hierarchy.json](../src/_data/intents/hierarchy.json) already owns
disclosure + `aria-level`/`setsize`/`posinset` + the Right/Left expand-then-descend / collapse-then-ascend
traversal + the **flatten-to-visible-rows projection**, and its summary *explicitly names treegrid as a
composer*: "Tree-select, treegrid, and nested menus compose this one intent." Industry agrees treegrid is a
grid **mode/feature**, not a separate component (AG Grid Tree Data; MUI X `treeData`; TanStack `getSubRows`)
— PrimeReact's distinct TreeTable is a *data-shape* convenience, not a different a11y contract. The unowned
residual is small: a 2-D grid whose **rows are the hierarchy's flattened-visible projection** + the
**Right/Left arbitration rule** (collapsed parent row + Right = expand; else move cell).

### Triage context

- **Kind**: data-grid projection/dimension (composition over two owned seams) · **Native grounding**: WAI-ARIA APG Treegrid (`role="treegrid"`, `aria-level`/`aria-expanded`/`posinset`/`setsize`)
- **Native-first**: ▽ low (adopt APG verbatim — already WE vocabulary) · **Gap**: ▽ low (both halves exist) · **Effort**: ▽ low · **Surfaced by**: #1400 (ARIA-APG lens) — flagged "lowest-confidence APG harvest"

### Recommended path at a glance

Ratify the row, or override the placement you'd change. **Confidence** says where judgment is actually needed.

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 · is treegrid a new block?** | a **`hierarchy` projection/dimension on `data-grid`** (rows = the flatten-to-visible projection; +the Right/Left arbitration rule) | a documented composition only *(fallback if no contract delta)* · its own block *(rejected — over-mints; re-derives two owned units)* | **~70%** — lowest-confidence APG item; a/b line resolves at authoring |

## Fork 1 — is treegrid a new block, a data-grid projection, or just documentation?

*Fork-existence:* the excluded branch is **"its own block,"** and it is **broken/over-minting** — it would
re-mint the 2-D nav engine `data-grid` already owns (`contractsOnly`) and re-derive the hierarchy/disclosure
the `hierarchy` intent already owns *and already names treegrid as a composer of*. Minting a third block
duplicates both halves and violates separate-and-decouple + impl-is-not-a-standard (PrimeReact's separate
TreeTable is a data-shape tooling convenience, not a standards necessity). The coherent branches — a
data-grid projection vs a doc-only composition — genuinely diverge on whether there is a *contract delta* to
home, so this is a real either/or.

**Fork 1 (a) — a `hierarchy` projection/dimension on `data-grid` (recommended, ~70%).** data-grid's row
axis is fed by the hierarchy intent's flatten-to-visible-rows projection; rows carry
`aria-level`/`aria-expanded`; the movement-engine seam gains the Right/Left disclosure-vs-cell arbitration
rule; the block adds `role="treegrid"` + `composesIntents: [..., "hierarchy"]`. No new block. This homes the
one genuinely new rule on the block whose `contractsOnly` architecture was built to absorb projections via
its seams, and matches the AG Grid / MUI / TanStack consensus (a grid *mode*).

**Fork 1 (b) — a documented composition only (fallback).** A note on data-grid + hierarchy ("compose them;
Right/Left arbitrates"). Correct *only* if authoring shows the Right/Left arbitration + projection wiring is
fully derivable from `we:src/_data/intents/hierarchy.json`'s existing rules with zero data-grid contract change. Under-delivers
otherwise — the arbitration rule is a real contract delta needing a named home + conformance vector.

**Fork 1 (c) — its own `treegrid` block (rejected).** The broken/over-minting branch above (~90% out).

*The residual (~30%):* the (a)/(b) line is thin and resolves at authoring time — if the arbitration rule
turns out to be zero-delta, (a) collapses into (b)'s doc note. This is the lowest-confidence APG-harvest
item by the card's own flag; (c) is firmly out regardless.

---

### Supported by default (not forks)

- **Row-grouping vs tree-data is not a fork (support-both).** Tree-data (intrinsic parent/child hierarchy)
  and row-grouping (grouping flat rows by a column value into synthetic parents) are two *data adapters*
  onto the one `hierarchy` projection — both produce a flatten-to-visible projection with
  `aria-level`/`aria-expanded`. One projection, two author-facing shapes; not two contracts.
- **Native `role="treegrid"` + the ARIA hierarchy attributes** — adopt APG verbatim (already WE vocabulary
  via the `hierarchy` intent).
- **The APG Right/Left dual semantics** — already specified in `we:src/_data/intents/hierarchy.json`; treegrid adds only the
  cell-movement fallback when the row isn't a collapsible parent.
- **The flatten-to-visible-rows projection** — already owned by `we:src/_data/intents/hierarchy.json` (Windowed Collection needs
  zero tree-specific changes).
- **Focus** — reuse data-grid's Focus-Delegation seam (orientation `both`); collapse-focuses-ancestor keeps
  focus in the projection.
- **Selection** — delegated to the Selection intent, independent of disclosure.

### Seams

- **data-grid** — 2-D cell navigation + the movement/active-cell seams (flat row axis only).
- **hierarchy / tree-select** — nesting + disclosure + the flatten projection (tree-select is 1-D).
- **treegrid (the composition)** — only the new residual: rows = the hierarchy projection feeding
  data-grid's row axis + the Right/Left arbitration rule — surfaced as data-grid's `hierarchy` projection,
  not a third engine.

### Realizing work (post-ratification, separately prioritized)

If Fork 1 (a) ratifies: add the `hierarchy` projection to `data-grid`'s contract (the Right/Left
arbitration rule, `role="treegrid"`, the composed `hierarchy` intent) + a conformance vector + a demo
(file-explorer treegrid). File via `/new-standard`. Not part of this placement call.
