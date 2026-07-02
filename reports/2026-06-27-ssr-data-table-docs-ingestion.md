# SSR data-table docs ingestion — how a server-rendered `<we-data-table>` acquires rows/columns for the transient-CE docs dogfood

**Point:** A non-interactive docs table ships plain SSR `<table>` and *does not upgrade*; an interactive one upgrades from a typed `<script type="application/json">` child (rows + plain column defs) layered over that same `<table>` baseline — never a lossy table-DOM re-parse, because the renderer sorts/filters on raw typed values the rendered DOM can't recover.

---

## Question

How does a server-rendered `<we-data-table>` (no per-element JS, 11ty static docs site) acquire its rows/columns, given that the FUI renderer ingests **only** via the JS properties `.rows` / `.config` — and `.config` is **function-valued** (`Column.format: (value,row)=>string|Node`, `Intl.Collator` comparators, filter predicates), so it serializes to neither SSR `<table>` DOM nor a JSON attribute? This blocks #1787 (the data-table transient-CE embed entry) and the whole #1600 table→data-table migration family (#1609–#1613).

## Recommendation

**Two-tier, interactivity-gated:**

- **Non-interactive docs table (the common case — ~most of the 219 migration-target tables):** the server emits a plain semantic `<table>` and the element **does not upgrade at all** (no JSON twin, no JS). The accessible/crawlable `<table>` is the single source of truth. This is the skeptic's correct point: shipping a JSON copy of strings you already encoded in DOM is unforced duplication.
- **Interactive docs table (sort/filter needed):** the element upgrades from a **typed `<script type="application/json">` child** carrying rows + plain column defs (`field`/`label`/`sortable`/`type`), layered over a real `<table>` no-JS / no-FOUC baseline. Function-valued options (`format`/comparators/predicates) are **absent** from the declarative subset — available only on the programmatic `.config` path (apps, not docs).

**Rejected: parsing the SSR `<table>` light DOM (option B) as the default.** It is *single-source* and zero-payload, which is genuinely attractive — but it is **merit-lossy in a correctness-affecting way**, not merely lossy in convenience: the renderer's contract sorts/filters/groups on **raw typed** `field` values (`Cell = string | number | null`; `fui:blocks/renderers/data-table/renderDataTable.ts:33` and `:49` "Sorting/filtering/grouping always run on the raw `field` value"), and `numeric` natural order, date order, and per-column `sortable` flags **cannot be recovered from rendered `<td>` text**. So B would silently produce wrong sort order on any numeric/date column the moment a docs table became interactive. B inverts the renderer's own data→DOM direction.

## Key Findings

- **The renderer is JS-property-only by deliberate design.** `fui:blocks/renderers/data-table/DataTableBehavior.ts:78-80` states it verbatim: *"Config carries call-site predicates/comparators, so it is a JS property, not an attribute."* The element (`DataTableModule`, `fui:blocks/renderers/data-table/DataTableBehavior.ts:82-100`) exposes only `set rows`/`set config` (`fui:blocks/renderers/data-table/DataTableBehavior.ts:87-90`); no light-DOM, no `<script>`, no attribute-JSON, no table-parse path exists today (confirmed absent).
- **Config is function-valued and unserializable.** `Column.format: (value,row)=>string|Node` (`fui:blocks/renderers/data-table/renderDataTable.ts:49`); `FilterPredicate.test: (row)=>boolean` (`fui:blocks/renderers/data-table/renderDataTable.ts:63-68`, "the predicate itself is call-site data"); `SortKey` mirrors `Intl.Collator` option names and is materialized into a real `Intl.Collator` (`fui:blocks/renderers/data-table/renderDataTable.ts:52-61` and `:106-114`). None of these cross a DOM/JSON boundary — which is exactly why the declarative docs subset must *drop* them, not try to carry them.
- **The transient-CE/SSR pattern already has two shapes in FUI, and data-table fits neither unchanged.** Badge (`fui:blocks/badge/BadgeElement.ts`, `fui:blocks/transient/TransientElement.ts:53-76`) self-replaces from **attributes + text**; code-view (`fui:blocks/code-view/CodeViewElement.ts:75-78`) hydrates `.code` from **light-DOM textContent** on upgrade. Both ingest scalars; data-table needs *structured typed rows*, which is a third ingestion shape — the JSON-island child — sitting beside those two.
- **The `<script type="application/json">` data-island is a real, spec-backed pattern.** HTML treats a `<script>` with a non-JS `type` as a "data block" — inert, not executed, content available via `.textContent` (WHATWG HTML §4.12.1 "the `script` element"; MDN documents `type="application/json"` / "importmap" as data-block uses). It is escape-safe with one known footgun (a literal `</script>` in a string), handled by `<\/` escaping at emit time — the same discipline 11ty/JSON-LD blocks already use.
- **Prior art: SSR `<table>` + progressive enhancement is the dominant declarative-data pattern; a hidden JSON twin is the minority.** AG Grid SSR / TanStack Table hydrate from a server-rendered table or a serialized model passed at hydration; design systems that ship a real `<table>` (Carbon DataTable, Spectrum TableView SSR, Shoelace — no native data-grid, defers to a `<table>`) keep the rendered table accessible and enhance it. The two-tier ruling adopts the *baseline `<table>` for accessibility/SEO/no-JS* universally, and only adds the JSON island where typed interactivity demands it.
- **No WE intent owns "data table" vocabulary.** `we:src/_data/intents/collection-operations.json` (status `concept`) owns the filter/sort/group/page *operations* semantics, and `we:src/_data/intents/selection.json` owns row selection orthogonally — but neither names "data-table". The block-level renderer is FUI-owned. **No shared registry edit is needed for this decision**; a future "declarative data-table ingestion subset" could become a `collection-operations` dimension, but that is a separate slice (noted, not minted here).
- **Skeptic verdict: SURVIVES-WITH-AMENDMENT.** The refute-only pass landed a strong attack — two serializations of the same rows in one payload is unforced duplication, and for *static* docs the JSON copy carries no information the table doesn't. That attack is **correct for the non-interactive case** and reshaped the default: the amendment is to *not upgrade non-interactive tables at all* (so there is no twin), reserving the JSON island for the interactive subset where its typed payload is load-bearing. The attack's call to flip wholesale to B was **rejected**: B can't recover typed sort keys, which is a correctness loss the skeptic under-weighted by assuming "docs tables are strings-only" — true for display, false for sort order.

## Files Created/Modified

| File | What |
|---|---|
| `we:reports/2026-06-27-ssr-data-table-docs-ingestion.md` | This session report (grounding) |
| `we:src/_data/researchTopics/ssr-data-table-docs-ingestion.json` | `/research/` topic (open) |
| `we:src/_includes/research-descriptions/ssr-data-table-docs-ingestion.njk` | `/research/` topic body |
| `we:backlog/1818-how-a-server-rendered-we-data-table-ingests-rows-columns-for.md` | Rewritten to the prepared-fork shape (one fork) + `relatedReport` |
