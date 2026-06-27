---
kind: decision
status: open
size: 2
locus: frontierui
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
preparedDate: "2026-06-27"
relatedReport: reports/2026-06-27-ssr-data-table-docs-ingestion.md
tags: [data-table, transient-ce, embed-boundary, ssr, webdocs]
---

# How a server-rendered we-data-table ingests rows/columns for the docs transient-CE dogfood (JS-property contract is function-valued)

## Digest

No declarative ingestion path exists yet — the FUI data-table renderer ingests **only** via the JS properties `.rows` / `.config`, and `.config` is **function-valued** (`fui:blocks/renderers/data-table/Column.format`, `Intl.Collator` comparators, predicates), so it serializes to neither an SSR `<table>` nor a JSON attribute. The one fork below — *what declarative ingestion path the docs surface uses* — is grounded in a prior-art survey published as the `/research/` topic [`ssr-data-table-docs-ingestion`](/research/#ssr-data-table-docs-ingestion) (report via `relatedReport`), and carries a **bold** default: a two-tier, interactivity-gated path (plain `<table>`, no upgrade, for static docs; a typed `<script type=application/json>` island over the same `<table>` for interactive ones).

The concern decomposes onto two grounded axes. **(1) The ingestion contract is closed and function-valued** — `fui:blocks/renderers/data-table/DataTableBehavior.ts:78-80` states verbatim *"Config carries call-site predicates/comparators, so it is a JS property, not an attribute,"* and `DataTableModule` (`fui:blocks/renderers/data-table/DataTableBehavior.ts:82-100`) exposes only `set rows`/`set config` (`fui:blocks/renderers/data-table/DataTableBehavior.ts:87-90`) with no light-DOM / script / attribute / table-parse path; the unserializable types are `Column.format` (`fui:blocks/renderers/data-table/renderDataTable.ts:49`), `FilterPredicate.test` (`fui:blocks/renderers/data-table/renderDataTable.ts:63-68`) and the `Intl.Collator`-backed `SortKey` (`fui:blocks/renderers/data-table/renderDataTable.ts:52-61`, `:106-114`). **(2) The renderer sorts on raw typed values, not rendered text** — `Cell = string | number | null` and sorting/filtering/grouping run on the raw `field` value (`fui:blocks/renderers/data-table/renderDataTable.ts:33`, `:49`), which is why a rendered-`<td>`-text re-parse can't recover `numeric`/date order or `sortable`. The transient-CE pattern siblings ingest only scalars — badge from attributes+text (`fui:blocks/transient/TransientElement.ts:53-76`), code-view from light-DOM textContent (`fui:blocks/code-view/CodeViewElement.ts:75-78`) — so data-table needs a third ingestion shape.

### Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| Fork 1 — docs ingestion path | **Two-tier: non-interactive ⇒ plain `<table>`, no upgrade; interactive ⇒ typed `<script type=application/json>` child over a `<table>` baseline (function-valued options absent from the declarative subset)** | (B) parse the SSR `<table>` light DOM as the single source | Med-high |

## Fork 1 — How a server-rendered docs `<we-data-table>` acquires its rows/columns

**Fork-existence justification:** a genuine either/or — the three branches **cannot coexist** as *the* docs ingestion path (one element, one upgrade contract; it reads its data from exactly one place), and (B) is **flawed**: re-parsing rendered `<td>` text cannot recover the raw typed values the renderer sorts on, so it silently produces wrong order on numeric/date columns. (Not a prioritization call — every branch is the same build size; they differ on correctness, not effort.)

**Crux (with refs):** the renderer ingests only `.rows`/`.config` (`fui:blocks/renderers/data-table/DataTableBehavior.ts:87-90`), and config is function-valued and unserializable (`fui:blocks/renderers/data-table/renderDataTable.ts:49`, `:63-68`, `:52-61`). A static docs `<table>` therefore cannot drive the current element. Sorting runs on raw typed `field` values, not on what's rendered (`fui:blocks/renderers/data-table/renderDataTable.ts:33`, `:49`). The spec-backed home for an inert structured payload is a non-JS-typed `<script>` data block (WHATWG HTML §4.12.1; MDN `type="application/json"`), read via `.textContent` — the third ingestion shape beside the badge/code-view scalars.

Options:

- **(a) — bold default — two-tier, interactivity-gated.** A **non-interactive** docs table ships a plain semantic `<table>` and the element **does not upgrade at all** (single source of truth, accessible/crawlable, zero JS, no JSON twin). An **interactive** docs table upgrades from a typed `<script type="application/json">` child carrying rows + plain column defs (`field`/`label`/`sortable`/`type`) layered over the same `<table>` as the no-JS / no-FOUC baseline; function-valued options (`format`/comparators/predicates) are **absent** from the declarative subset, available only on the programmatic `.config` path (apps). *Merit:* lossless for the typed data it carries where it matters, no DOM re-parse, accessible baseline universally, no duplication on the common (static) case, native-first.
- **(b) parse the SSR `<table>` light DOM.** Element reads `thead`→columns, `tbody`→rows (strings) and builds a config. Single source of truth, zero payload — but **lossy in a correctness-affecting way**: everything stringifies, so `numeric`/date sort order and per-column `sortable`/`type` cannot be recovered, and it inverts the renderer's data→DOM direction. Fine only if a table is *never* interactive — which (a) already covers more cleanly by not upgrading at all.
- **(c) `data-*` attribute JSON.** Like (a)'s island but the payload rides an attribute — worse escaping/size for large tables, no benefit over a typed `<script>` child, and not the spec's home for an inert data block.

**Default: (a) — two-tier, interactivity-gated.** It keeps the accessible `<table>` as a universal baseline, avoids any JSON twin on the common static case (the skeptic's correct duplication point), and only adds a typed island where interactivity genuinely needs typed sort keys.

Rejected branches:
- **(b) parse the `<table>`** — *Rejected:* recovers only strings, so numeric/date sort and `sortable` flags are unrecoverable; silently wrong sort order on any non-string column; inverts the renderer's own data→DOM direction.
- **(c) attribute JSON** — *Rejected:* strictly worse than the `<script>` island (attribute size/escaping) with no benefit; the spec's home for an inert data block is a non-JS-typed `<script>` child, not an attribute.

Skeptic: SURVIVES-WITH-AMENDMENT — beat the "two serializations of the same rows is unforced duplication / two sources of truth" attack by *not upgrading non-interactive tables at all* (so there is no twin); the attack's call to flip wholesale to (b) was refuted on the typed-sort-key correctness loss (b can't recover `numeric`/date order from rendered text).

---

## Context

**Lineage.** This decision **blocks #1787** (the data-table transient-CE embed entry, `fui:embed/data-table-in-document.ts`, which lists this item in its `blockedBy`) — the docs ingestion path must be settled before that entry builds. #1787 is in turn the foundational prerequisite for the #1600 table→data-table migration family (#1609 project-descriptions, #1610 plug-descriptions, #1611 adapter-descriptions + top-level, #1612 block-descriptions, #1613 research-descriptions — ~219 static `<table>` surfaces total). Pattern siblings: badge embed #1758, code-view embed #1785.

**Supported by default (not decisions).** The programmatic JS-property path (`.rows` / `.config` with the full function-valued contract) is unaffected and remains the path apps use — this decision only adds a *declarative docs* ingestion shape beside it; nothing is removed.

**Standard-layer note (no registry edit here).** No WE intent owns "data table" vocabulary: `we:src/_data/intents/collection-operations.json` (status `concept`) owns the filter/sort/group/page *operations* and `we:src/_data/intents/selection.json` owns row selection orthogonally, but neither names data-table; the renderer is FUI-owned. A future "declarative data-table ingestion subset" could become a `collection-operations` dimension, but that is a **separate slice** — noted, deliberately **not minted** in this prep.
