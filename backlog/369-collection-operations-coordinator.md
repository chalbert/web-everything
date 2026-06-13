---
type: idea
workItem: story
size: 5
status: open
dateOpened: "2026-06-12"
blockedBy: ["452"]
tags: [collection-operations, data-table, pagination, composition, exercise-app-discovery]
crossRef: { url: /backlog/317-exercise-app-loan-origination/, label: "Surfaced composing data-table + pagination in app A (#317)" }
---

# Collection-operations coordinator — compose data-table + pagination over one collection

Gap surfaced when the loan-origination app ([#317](/backlog/317-exercise-app-loan-origination/)) became
the first consumer to compose the **data-table** and **pagination** blocks over a real (5k-row)
collection. The two blocks each own one stage of the collection-operations pipeline (data-table:
filter/sort/group; pagination: page) but there is **no coordinator** that runs the pipeline as a whole.
Concretely: data-table's click-to-sort sorts only the **current page**, not the whole book — so paging
then sorting gives page-local order, not collection-wide order. The contract says filter → sort → group →
**page**; today the consumer must hand-wire that order, and the obvious wiring (page-then-render) puts
sort after page.

## What's needed

A small **collection-operations coordinator** (behavior or composition helper) that owns the single
collection and the full pipeline: apply filter → sort → group across the **whole** set, then hand the
**current page slice** to the data-table for rendering, and the totals to the pagination block. Sort/filter
events from the data-table and page events from pagination both feed the coordinator, which re-runs the
pipeline and re-windows. `applyPipeline` already exists for filter/sort/group; the coordinator adds the
page stage + the event wiring + (optionally) Loader integration for server-side pipelines.

## Open questions

The home fork — **coordinator as a standalone block vs. a documented composition** — was carved to
decision **#452**, **resolved 2026-06-13 → A / A**: build a **standalone headless
`CollectionOperationsBehavior` + optional `<collection-operations>` element wrapper** (mirror
`DataTableBehavior`/`DataTableElement` + `PaginationBehavior`), **not** a documented composition and
**not** a rendered block. Lands in `blocks/renderers/collection-operations/`. Ship the element wrapper
in the same slice as the behavior. This item is now agent-ready — see #452's *Ruling* for the full call.

Not forks (supported by default, noted for the build): client-side vs. server-driven is UX-only — the
coordinator picks the strategy at runtime (ties to the Technical Configurator), not a design call.
#036 (resolved → the `pagination` block) realized only the page dimension and does not own this
cross-block coordinator.
