---
kind: story
size: 5
status: resolved
blockedBy: ["2007"]
dateOpened: "2026-07-01"
dateResolved: "2026-07-01"
graduatedTo: none
tags: [data-table, composition, light-dom, ssr, migration-1600]
---

# we-data-table has two incompatible feed identities (rebuild-from-data vs enhance-live-DOM) — #1600 left inert wrappers

> **Retired — duplicate of [#1964](1964-we-data-table-migration-in-place-wrap-vs-render-from-data-bi.md).** #1964
> is the prepared, active decision on this exact question (does the #1600 wrap conform), with fork (a) recommended.
> This item's grounding was also **wrong**: it claimed the docs register the `DataTableEnhancer` (guards bail → inert
> wrapper), but the docs register `DataTableModule` (the `replaceChildren` behavior kernel) — the wrap survives only
> because `sync()` early-returns without `.config` (see #1964's grounding). Work the question in #1964.

`we-data-table` carries two incompatible feed identities under one tag: **(A) rebuild-from-data**
(`DataTableBehavior`/`renderDataTable` via `.rows`/`.config` — owns rendering, can restructure) and **(B)
enhance-live-SSR-DOM in place** (`DataTableEnhancer` — reorders/hides existing `<tr>`, structure-preserving only,
cannot do a mobile card view). The #1600 migration wrapped WE-docs tables (capabilities/intent/block/capability
pages) in `<we-data-table>` WITHOUT the `.data-table` contract (no `class=data-table`, no `th[data-sortable]`, no
`data-sort-value`), so the enhancer bails on both guards and the wrapper is inert — a no-op custom element around a
plain table. Fix per the #2007 feed-mechanism rule: either complete the migration (give the tables the `.data-table`
contract so enhancement actually works) or revert the pointless wrap. Blocked on the #2007 governance ruling.

## Evidence

- Wrapping without the contract: [we:src/capabilities.njk:42](../src/capabilities.njk#L42)
  (`<we-data-table><table style="…">` — inline styles, no `class="data-table"`). Same shape in
  we:src/capability-pages.njk, we:src/intent-pages.njk, we:src/block-pages.njk.
- Both enhancer entry points bail on that markup
  ([fui:blocks/renderers/data-table/DataTableEnhancer.ts](../../frontierui/blocks/renderers/data-table/DataTableEnhancer.ts)):
  - `connectedCallback`: `if (!this.querySelector('table.data-table')) return;`
  - `enhanceDataTables`: `if (!table.querySelector('th[data-sortable]')) continue;`
- So on those pages the `<we-data-table>` element attaches, finds nothing enhanceable, and does nothing — the
  "table inside a we-data-table" that reads as nonsensical.

## The dual-identity smell (the design half)

Path (A) is a legitimate **data feed** (component owns the rendered shape — the #2007-compliant model). Path (B) is
a **live-DOM feed** the component mutates in place — structurally capped at reorder/hide (no responsive re-layout).
Whether B is an outright #2007 violation or a *sanctioned carve-out* (SSR progressive enhancement, no-JS semantic
table) is **precisely #2007's open red-team question** — this story does not pre-judge it. Either way, housing both
feed models under one `we-data-table` tag is the root confusion. The #2007 ruling decides the direction:

- **If a docs data-table should own its shape** (sortable now, responsive later) → drop path B; feed via
  `<template>`/data and let the component render. The inert #1600 wrappers get the real `.data-table` contract or
  are replaced by the rebuild path.
- **If SSR-no-JS semantic tables are the goal** (no restructure ever) → these are plain projection; drop the
  `<we-data-table>` wrapper entirely (it earns nothing) until a table genuinely needs enhancement.

## Acceptance

- No inert `<we-data-table>` wrappers remain: every `<we-data-table>` on WE-docs pages either enhances a real
  `.data-table` or is removed.
- The dual feed identity is resolved per the #2007 ruling (documented which path `we-data-table` keeps, and why).
- Before/after visual check on the running dev server for each touched docs page (UI-change rule).
