---
kind: decision
status: active
size: 2
locus: webeverything
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
preparedDate: "2026-06-27"
relatedReport: reports/2026-06-27-ssr-data-table-docs-ingestion.md
tags: [data-table, transient-ce, embed-boundary, ssr, webdocs, ingestion-interface, webexpressions, injector-context]
---

# DECISION: The block data-ingestion interface — typed property vs attribute web-expression vs SSR `<table>` (extends #1570)

## Digest

How a WE block declares the way it receives **complete data** (rows/options/config), and a strict, reproducible rule for which form is valid when. Most of it is **already ratified** — `#persistent-b-data-source` (#1570) keys the property-vs-attribute-vs-markup choice on **kernel shape**. This decision adds the one axis #1570 never faced — **SSR / no-JS runtime context**: a simple static table ⇒ the `<table>` is the source; a complex/interactive table ⇒ a `[[ ref ]]` attribute web-expression bound to an injector context, with the `<table>` as no-JS baseline. One new general capability falls out — SSR injector-context hydration (#1827) — its own card and a `blockedBy` for the complex path.

## The rule (what gets codified)

A WE block sources its **complete data** from exactly one of these forms, chosen by **kernel shape × runtime context** — not by ad-hoc per-block taste:

| Situation | Ingestion form | Source of truth | Mechanism / authority |
|---|---|---|---|
| **render-from-data kernel, has JS** (app) | typed JS property `.rows` / `.config` (full function-valued contract: `format`, comparators, predicates) | the property | #1570 — the floor |
| **render-from-data kernel, declarative** | attribute web-expression `rows="[[ ref ]]"`, resolved **against the injector chain** | the bound context | #1570 — the optional declarative form |
| **light-DOM-scan kernel** (enhance authored markup in place) | the authored markup | the markup | #1570 — markup *is* the source (no fork) |
| **render-from-data kernel, SSR / no JS, simple** | the server-rendered `<table>` itself (element does not render-from-data: no upgrade, or scan-enhance-in-place) | the `<table>` | **this decision** (new SSR axis) |
| **render-from-data kernel, SSR, complex / interactive** | `rows="[[ @ctx ]]"` bound to an injector context, `<table>` as no-JS baseline | the context | **this decision** + #1827 (SSR context hydration) |

**Precedence when more than one is present:** the **typed JS property is authoritative** (it carries the full function-valued contract); an attribute `[[ ref ]]` is the *declarative* path to the same property and is superseded by an explicit property set; authored markup is a source **only** for light-DOM-scan kernels and is **never** read by a render-from-data kernel (the kernel does `host.innerHTML=''`/builds fresh, so any parsed markup would be destroyed — #1570).

## What #1570 already settled (do not re-open)

`#persistent-b-data-source` (ratified, lineage #1570) governs the property-vs-attribute-vs-markup choice for any `we-` element whose kernel **renders DOM from a data array** — which `we-data-table` is: `fui:blocks/renderers/data-table/renderDataTable.ts:335` does `document.createElement('table')` and builds fresh from `.rows`. For that kernel shape:

- **typed property `.rows`/`.config` is the floor** — `fui:blocks/renderers/data-table/DataTableBehavior.ts:87-90` (`set rows`/`set config` only). `.config` is **function-valued** (`Column.format` `fui:blocks/renderers/data-table/renderDataTable.ts:48`, `FilterPredicate.test` `:63-68`, `Intl.Collator`-backed `SortKey` `:52-61`), so it never serializes to an attribute or markup — by design, verbatim *"Config carries call-site predicates/comparators, so it is a JS property, not an attribute."*
- **optional declarative form = `[[ ref ]]` on the element's own attribute**, resolved by reusing `we:plugs/webexpressions/CustomExpressionParser` — and `webexpressions` resolves a ref **against the injector chain** (`CustomExpressionParser` *"Context query — resolved from injector chain"*, `contexts: Record<string, unknown>`). So the declarative form binds to a **context provider**, not to per-element payload.
- **markup-parse is rejected** for render-from-data kernels; it is the source only for **light-DOM-scan** kernels.

## What this decision adds — the SSR / no-JS axis

#1570's two declarative forms both need a **live JS context** (a property needs JS; `[[ ref ]]` needs a resolvable injector context + the watcher running). Neither yields a server-rendered, zero-JS, accessible table — the docs surface's actual requirement. Resolution:

- **Simple / static docs table → the `<table>` itself is the source.** The element does **not** render-from-data: it either doesn't upgrade or upgrades scan-enhance-in-place (never `innerHTML=''`). Lossless because the simple declarative subset has **no `format()`**, so rendered `<td>` text == raw `field` value, and a `type` hint recovers `numeric`/date order. This is the path the #1600 docs-table family ships on now.
- **Complex / interactive docs table → `rows="[[ @ctx ]]"` bound to an injector context**, with the `<table>` as the no-JS / no-FOUC baseline. **No per-table JSON island** (rejected: duplicates every row already in the `<table>`, two sources of truth, payload bloat) and **no scan+sidecar** (rejected for complex: `format()` reappears, so rendered text ≠ raw value and sort keys are unrecoverable from the `<td>`). The data lives in one page/region context, not per table.

**New capability this requires → its own card.** The complex path needs the injector context to be **seeded from server-rendered state** when JS boots, so the `[[ ref ]]` has something to resolve against. That is general (every block's `[[ ref ]]` form wants it, not just data-table), so it is filed as **#1827 — SSR injector-context hydration**, and is a `blockedBy` for the complex-table consumer, not for this rule's ratification.

## Context

**Lineage / consumers.** Surfaced building #1787 (the data-table transient-CE embed entry, `fui:embed/data-table-in-document.ts`, which lists this item in its `blockedBy`) — but the call is WE-layer, not FUI. #1787 is the foundational prerequisite for the #1600 table→data-table migration family (#1609 project-descriptions, #1610 plug-descriptions, #1611 adapter-descriptions + top-level, #1612 block-descriptions, #1613 research-descriptions — ~219 static `<table>` surfaces). Those are all **simple** tables → they ship now on the `<table>`-is-the-source path. Pattern siblings (scalar ingestion): badge embed #1758, code-view embed #1785.

**Home on resolve.** Graduates to a new clause in `we:docs/agent/platform-decisions.md` that **extends `#persistent-b-data-source`** with the SSR/runtime-context axis and the precedence rule — set `graduatedTo` / `codifiedIn` accordingly. No intent-registry edit here: no WE intent owns "data table" vocabulary (`we:src/_data/intents/collection-operations.json` owns the filter/sort/group/page *operations*, `we:src/_data/intents/selection.json` owns row selection); a "declarative data-table ingestion subset" could later become a `collection-operations` dimension, but that is a separate slice — deliberately not minted here.

**Supported by default (not a decision).** The programmatic JS-property path (`.rows`/`.config`, full function-valued contract) is unaffected and remains the app path; this decision only standardises the declarative/SSR shapes beside it. Nothing is removed.
