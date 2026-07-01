---
kind: story
size: 5
status: resolved
dateOpened: "2026-07-01"
dateStarted: "2026-07-01"
dateResolved: "2026-07-01"
tags: [data-table, composition, ssr, migration-1600]
---

# Migrate #1600 doc-table wraps — complete the #1867 contract or revert to plain `<table>` (per ratified #1964)

Ratified #1964 (reconciled to the #2007 restructure-vs-enhance discriminator): a `<we-data-table>` wrapping a live
`<table>` conforms **iff** the table carries the #1867 in-place-enhancer contract
(`.data-table` + `<th data-sortable>` + `<td data-sort-value>`) and is only reordered/hidden. The #1600 wraps carry
**none** of it, so each is an inert wrapper around a plain table — a **missing-contract defect**. Fix per surface
across the wrap sites
(we:src/capabilities.njk, we:src/capability-pages.njk, we:src/intent-pages.njk, we:src/block-pages.njk,
we:src/presets.njk, we:src/validation-rules.njk, we:src/compat.njk):

- **Genuinely sortable doc table → complete the #1867 contract.** Add `.data-table` + `<th data-sortable>` +
  `<td data-sort-value>` (stamped from the same data the Nunjucks loop already iterates); keep the `<we-data-table>`
  wrapper. The enhancer reorders in place, reads `data-*`, never re-renders.
- **Presentational grid → revert to a plain `<table class="data-table">`** (drop the `<we-data-table>`; it earns
  nothing on a table nobody sorts). Keeps the styling class.

Also swap the docs embed (fui:embed/data-table-in-document.ts) from `registerDataTable` to
`registerDataTableEnhancer` so the client path refines in place and can never `replaceChildren` a config-less wrap
(R3). No inert `<we-data-table>` wrapper remains. Per-page before/after visual check on the running dev server.

## Acceptance

- Every `<we-data-table>` on the 7 wrap-site pages either enhances a real `.data-table` (contract present) or is
  removed.
- Embed registers `registerDataTableEnhancer`; a config-less wrap provably never `replaceChildren`s (regression
  test asserting a wrap keeps its rows).
- Before/after visual parity on each touched page.

## Resolution

Every wrap on the 7 pages was a **presentational grid** — description-heavy reference tables (block API
reference: attributes/properties/events/slots/CSS props/parts; intent dimensions & design-system research;
preset CEM attributes; validation-rule cross-tool matrix) or single-row / pivoted capability matrices. None
is a data grid a reader sorts, so all took the **revert path**: the `<we-data-table>` wrapper is dropped and
each table is now a plain `<table class="data-table">` (styling class kept; the enhancer's `data-sortable` /
`data-sort-value` contract is intentionally absent). No inert wrapper remains
(`grep we-data-table` over the 7 files is empty).

The docs embed (`fui:embed/data-table-in-document.ts`) now registers `registerDataTableEnhancer` (the #1867
slice-B in-place path) instead of `registerDataTable` — so a config-less wrap can never `replaceChildren` its
own rows. The R3 invariant is pinned by a regression test in
`fui:blocks/renderers/data-table/__tests__/data-table-enhancer.test.ts` ("config-less `<we-data-table>`
wrapping a plain doc table keeps its rows"). Since the reverted WE tables are plain (unwrapped) `.data-table`s,
no doc table is auto-enhanced — the embed only defines the element; the reverted markup carries no wrapper for
it to upgrade.
