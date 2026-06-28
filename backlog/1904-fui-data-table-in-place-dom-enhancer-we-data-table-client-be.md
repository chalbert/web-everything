---
kind: story
size: 3
parent: "1600"
locus: frontierui
status: resolved
dateOpened: "2026-06-28"
dateStarted: "2026-06-28"
dateResolved: "2026-06-28"
tags: [data-table, ssr, in-place-enhancer, frontierui]
---

# FUI data-table in-place DOM enhancer (we-data-table client behavior, no re-render)

Slice B of the #1867 harness. The `we-data-table` custom-element client behavior that reorders/hides the EXISTING SSR rows on sort/filter/page by reading the raw data-* keys (`<td data-sort-value>`, `<th data-type data-sortable>`) — no re-render, no JSON island, which is what keeps the build↔client skew class structurally gone. A distinct client path from the current rebuild-from-.rows/.config CE (fui:blocks/renderers/data-table/DataTableBehavior.ts:82-100, fui:embed/data-table-in-document.ts:44-52). Independent of slice A's code — built against the ratified #1867 cell contract; demoable on a static SSR fixture. Homed in FUI (locus: frontierui).

## Progress (batch-2026-06-28)

Slice B landed in `frontierui` (impl is FUI-homed; WE carries only the contract + this item file).

1. **In-place enhancer — `fui:blocks/renderers/data-table/DataTableEnhancer.ts` (new):**
   - `DataTableEnhancer(host)` attaches to the SERVER-rendered `<table class="data-table">` and reads its
     sortable columns back OUT of the SSR head (`<th data-sortable data-type>` + `<button data-action=sort
     data-field>`). There is no `.rows`/`.config` and no JSON island — **the rendered markup IS the
     contract** (the #1867 skew mitigation).
   - `sort(field, state)` reorders the EXISTING `<tr>` nodes by their raw `<td data-sort-value>` keys —
     `tbody.append(existingRow)` **re-parents** (moves, never clones/re-renders) — and toggles `aria-sort`
     (exactly one sorted header, APG). Numeric columns (`data-type="number"`) compare by value; everything
     else via `Intl.Collator`; empties sort last (SQL NULLS LAST, direction-independent) — mirrors the
     verified build comparator (`fui:blocks/renderers/data-table/renderDataTable.ts` `compareByKey`).
     Header clicks drive the none→asc→desc→none cycle via the shared `nextSortState`.
   - `filter(predicate?)` / `page(size?, index?)` are in-place too: they toggle the `hidden` attribute on
     existing rows (never remove them), so clearing restores the full set with no re-render; page windows
     compose **after** the filter. Emits a `data-table-change` event + optional `onChange`.
   - `DataTableEnhancedElement` (`<we-data-table>`) is the declarative progressive-enhancement path that,
     on connect, enhances the SSR table in place — the distinct client path vs `DataTableModule`'s rebuild.
     `enhanceDataTables(root)` is the imperative entry; `registerDataTableEnhancer(tag)` the registrar.
   - All DOM access is `querySelector`-based (not the `HTMLTableElement.tHead`/`.tBodies` IDL accessors,
     which the `happy-dom` test shim does not implement), so it runs identically in-browser and under CI.
2. **Barrel + contract surface:** added `DataTableEnhancer` / `DataTableEnhancedElement` /
   `enhanceDataTables` / `registerDataTableEnhancer` to `fui:blocks/renderers/data-table/index.ts` and to
   the block's declared `exports` (`we:src/_data/blocks/data-table.json`) — keeps the #927 contract↔barrel
   parity green.
3. **Proof — `fui:blocks/renderers/data-table/__tests__/data-table-enhancer.test.ts` (9 tests):** drives
   the genuine build↔client seam — `renderDataTable` (the same renderer the build CLI uses) emits the SSR
   markup, the enhancer enhances it. Asserts the SAME `<tr>` node objects survive a reorder (no rebuild),
   numeric sort runs on the RAW `data-sort-value` not the formatted `$95k` display, the APG click cycle,
   in-place filter/page via `hidden`, the change event, and the `<we-data-table>` declarative path.

`check:standards` green (local, on the WE-side changed files); FUI: all 51 data-table tests (42 prior + 9
new) + project `tsc --noEmit` green. The non-deterministic app case stays #1827; end-to-end build wiring is
slice C (#1905, `blockedBy: ["1902","1904"]` — now both resolved).
