# Collection-operations coordinator — home & shape (prep research for #452)

**Date:** 2026-06-13
**Backlog:** [#452](../backlog/452-collection-operations-coordinator-standalone-block-vs-docume.md)
(decision) · unblocks [#369](../backlog/369-collection-operations-coordinator.md) (build) ·
surfaced by app A [#317](../backlog/317-exercise-app-loan-origination.md)
**Prior research:** [/research/collection-operations](https://…/research/collection-operations/)
(the four-op intent vocabulary; decided 2026-06-03)

## The question

App A composed the **data-table** block (owns filter/sort/group) and the **pagination** block (owns
page) over one 5k-row collection and hit the gap #369 reports: data-table's click-to-sort sorts only
the *current page*, because the consumer hand-wires page-then-render. The contract is filter → sort →
group → **page** (page last, over the whole set), but nothing owns the *whole* pipeline. So: **where
does the coordinator live, and what shape is it?**

The item framed one fork — standalone block (A) vs documented composition (B), lean A. This survey
runs the owed prior-art pass on the *coordinator-home* question specifically (the existing
collection-operations research covered the four-op vocabulary, not the orchestration home), and it
**reshapes the fork**: the home question (A) is near-unanimous, but a second axis the item didn't name
— *what shape* the standalone primitive takes — is where the real industry signal is.

## What shipped already (concrete refs — this is mostly ratify-shipped-code)

- `applyPipeline(rows, config)` runs filter→sort→group in `config.order ?? DEFAULT_ORDER` and returns
  normalized groups; **the page stage is a deliberate no-op** — "it is the Pagination block's job
  (compose, never merge)" — [blocks/renderers/data-table/renderDataTable.ts:143-196](../blocks/renderers/data-table/renderDataTable.ts#L143).
- `DataTableBehavior` is a **headless instance**: mounts into a host, delegates header clicks to
  `applySortClick`, re-renders, emits `data-table-change` so a consumer can re-window —
  [blocks/renderers/data-table/DataTableBehavior.ts:26-75](../blocks/renderers/data-table/DataTableBehavior.ts#L26).
  A `DataTableElement` custom-element wrapper drives the behavior over itself
  ([:82-104](../blocks/renderers/data-table/DataTableBehavior.ts#L82)).
- `PaginationBehavior` is the same shape: owns `PageState`, emits `pagination-change` "so a consumer
  can re-window its collection" — [blocks/renderers/pagination/PaginationBehavior.ts:1-12](../blocks/renderers/pagination/PaginationBehavior.ts#L1).
  `PageState = { pageIndex, pageSize, total }`, range "Showing 21–40 of 500" —
  [renderPagination.ts:26-57](../blocks/renderers/pagination/renderPagination.ts#L26).
- The intent already declares `pipelineOrder` (configurable, default filter→sort→group→page) and is
  **UX-only** — `src/_data/intents.json` `collection-operations`.

So the gap is purely the **missing seam owner** between two existing headless behaviors. The
coordinator re-runs `applyPipeline` over the full set on any `data-table-change`, then feeds the
current `PageState` slice back to the table and the totals to pagination on any `pagination-change`.

## Prior-art survey — how the leading grids coordinate the pipeline

| Library | Stage order | Pagination = terminal stage over whole set? | Coordinator home |
|---|---|---|---|
| **TanStack Table v8** | core → filtered → grouped → sorted → expanded → **pagination** → final; order **library-owned, not consumer-configurable** | Yes — pagination row model is the terminal slice | **Headless "table instance"** (`useReactTable`/`createTable`) — owns state + the row-model pipeline, no markup |
| **AG Grid** (client-side row model) | Store → Filter → Sort → Group → Aggregate → Flatten | Yes, but the pager is a **`PaginationProxy`** *over* the pipeline tail, not a stage *in* it | **`RowModel` instance** (MVC); one `PaginationProxy` slices the flattened output |
| **MUI X DataGrid** | filter → sort → **paginate** (internal) | Yes — paginate after filter/sort | **Fused into the component** (`paginationModel = {page,pageSize}`, `paginationMode` server/client) |

Sources: [tanstack.com/table row-models](https://tanstack.com/table/latest/docs/guide/row-models),
[ag-grid.com row-models](https://www.ag-grid.com/javascript-data-grid/row-models/),
[mui.com data-grid pagination](https://mui.com/x/react-data-grid/pagination/).

### Three findings

1. **Pagination is universally the terminal stage over the whole collection.** Filter/sort/group run
   on the full set; page slices last. This *confirms the existing WE split* — `applyPipeline` no-ops
   the page stage on purpose, and `PageState` carries the total. Nobody pages-then-sorts; #369's bug
   is a wiring error, not a contract gap.
2. **The page stage is decoupled from the transform stages.** AG Grid's `PaginationProxy` makes this
   explicit: the coordinator owns filter/sort/group; the pagination control is a thin *view onto the
   tail*. This is exactly WE's two-block split — so the coordinator should own the *order and
   re-windowing*, and must **not** absorb the page stage back out of the pagination block (bias toward
   separation holds).
3. **The dominant home is a *headless instance*, not docs-only and not a rendered block.** TanStack
   and AG Grid both ship a state/instance object ("row model"/"table instance") that owns the whole
   pipeline and hands *rendering* to the consumer. **Nobody ships option B** ("here's the order, wire
   it yourself") as the recommended path — that's the very footgun #369 hit. MUI fuses the coordinator
   into a monolithic component (the opposite extreme; not WE's compose-don't-merge style).

This is the reshaping: option A is right, but the survey says the standalone primitive should be a
**headless coordinator behavior** (matching WE's existing `DataTableBehavior`/`PaginationBehavior`
convention) — *not* a rendered "block" with markup of its own (it has no DOM; it orchestrates two
blocks that do), and not docs-only.

### Vocabulary worth borrowing

- **"pipeline" / "stage"** — already in WE (`applyPipeline`, `config.order`); keep it.
- **"row model" / "coordinator instance"** — the headless-instance framing.
- **`paginationModel = { page, pageSize }`** — MUI's clean state shape; WE already has the equivalent
  `PageState = { pageIndex, pageSize, total }`. No new vocabulary needed.
- **client / server mode** (TanStack `manual*`, MUI `paginationMode`) — one coordinator fronts either
  an in-memory full set or a server-paged source. WE already routes this through the Technical
  Configurator (UX-only intent); confirms client-vs-server is **not** a design fork.

## Recommendation (grounds #452)

1. **Fork 1 — home: option A (standalone primitive).** The recurring, identical filter→sort→group→page
   wiring earns its own home; the industry universally owns it in one place and never ships docs-only.
2. **Fork 2 (new, from the survey) — shape: a headless coordinator *behavior*, not a rendered block.**
   `CollectionOperationsBehavior` (working name) owns the full pipeline over the single collection,
   subscribes to `data-table-change` + `pagination-change`, re-runs `applyPipeline` + the page stage,
   re-windows, and pushes the slice to the table and totals to pagination — with an optional
   `<collection-operations>` element wrapper, mirroring `DataTableBehavior`/`DataTableElement`. No
   markup of its own; compose-don't-merge (the page stage stays owned by the pagination block's
   `PageState`).
3. **Not a fork (supported by default):** client (in-memory `applyPipeline`) vs server (params →
   Loader) — runtime-selected, ties to the Technical Configurator, most-permissive default (support
   both; default client when the full set is present, server when a Loader is wired).

## Per-fork classification (the fixed 7-question pass)

Applied to the coordinator primitive:

1. **Which layer?** WE `blocks/renderers/collection-operations/` for the reference behavior + element
   (the standard), exactly where `data-table`/`pagination` behaviors already live; richer impl
   (virtualization, very large sets) → Frontier UI later. Standard in WE, impl in FUI.
2. **Protocol or intent dimension?** Neither new — the `collection-operations` intent already exists
   (UX-only) and declares `pipelineOrder`. The coordinator is the *runtime that executes the intent*,
   not a new protocol or dimension.
3. **Expose the whole axis?** Client-vs-server execution is exposed as a runtime strategy (Technical
   Configurator), not a design fork — both end-states are legitimate, so the whole axis is supported.
4. **Fixed mechanic or dimension?** Stage *order* is already a configurable dimension (`config.order`).
   **Page-as-terminal-stage over the whole set is a fixed mechanic** — every surveyed library enforces
   it; exposing "page-then-sort" would only re-enable #369's bug.
5. **DI-injectable?** Yes — execution strategy (client `applyPipeline` vs server Loader params) is
   injectable; ambient defaults (page size, collation/locale) ride the intent DI channel.
6. **Most-permissive default?** Support both client and server; default to whichever the wiring
   implies (client when the full set is in memory, server when a Loader is present).
7. **Seam between intents?** The coordinator sits at the seam of collection-operations (the pipeline) ×
   pagination/windowed-collection (which items render) × loader (async fetch). It **orchestrates,
   does not merge** — the page stage stays owned by pagination's `PageState`; the coordinator owns
   order + re-windowing. Bias toward separation upheld: a thin orchestrator, not a super-block.

## Confidence

High on both forks. Fork 1 (home = standalone): the industry is unanimous and the bug is the
docs-only footgun itself. Fork 2 (shape = headless behavior): directly mirrors two shipped WE
behaviors and the dominant headless-instance pattern; the only judgment call is the working name and
whether the element wrapper ships in the same slice (recommend: yes, for parity).
