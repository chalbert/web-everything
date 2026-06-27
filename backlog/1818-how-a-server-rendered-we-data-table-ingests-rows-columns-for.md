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

# DECISION: The block data-ingestion interface — one `[[ ref ]]` form, resolved by determinism × interactivity (extends #1570)

## Digest

How a WE block receives **complete data** (rows/options/config), as a strict reproducible rule. There is **one declarative form** — an attribute web-expression `rows="[[ ref ]]"` binding to a context (the #1570 form) — and two axes decide the rest: **determinism** (context build-known?) sets *where* it resolves (server vs client); **interactivity** (client re-renders?) sets *whether* resolved data ships to the client. The `webexpressions` parser is DOM-free, so a deterministic binding resolves at **build time** → plain `<table>`, ship nothing. #1827 (runtime hydration) is the non-deterministic app case only — off the docs path.

## The rule (what gets codified)

A `we-` block whose kernel **renders DOM from a data array** (a render-from-data kernel, per #1570 — `we-data-table` is one) sources its complete data from **one declarative form**: an attribute web-expression `rows="[[ ref ]]"` (and `config="[[ ref ]]"`) that binds to a **context**. The typed JS property `.rows`/`.config` remains the imperative floor underneath it (the binding is the declarative path to the same property). What changes by situation is *not the form* but **where the binding resolves** and **whether the resolved data is shipped to the client** — set by two orthogonal axes:

| | **non-interactive** (no client re-render) | **interactive** (client sorts / filters) |
|---|---|---|
| **deterministic** (context build-known) | server resolves the binding → renders a plain `<table>`, **ships nothing**, binding is dropped | server renders the `<table>` baseline **+ ships the serialized resolved context** (the inert `<script type="application/json">` payload) for the client to re-bind and re-render |
| **non-deterministic** (context client-only) | client resolves + renders once (no server baseline) | ship the binding **+ runtime context hydration (#1827)**; the app case |

**Why this is one rule, not four forms.** The `webexpressions` evaluator is **DOM-free** — `CustomExpressionParser.evaluate(resolved: ResolvedValues)` takes a pre-resolved `contexts: Record<string, unknown>` and returns a value (`we:plugs/webexpressions/CustomExpressionParser.ts:42-61`); the only DOM coupling is the *runtime* text-node binding layer (`we:plugs/webexpressions/CustomTextNodeRegistry.ts:262` `document.createTreeWalker`), not the evaluation. So at **build time** you supply the deterministic context directly and `evaluate()` produces the rows — the server renders the `<table>` from them and resolves the binding away. The familiar paths are *derived consequences*, not separate ingestion shapes:

- **"Simple docs table → plain `<table>`"** = deterministic + non-interactive: the binding resolves at build, nothing ships, the element need not upgrade.
- **"JSON island"** = deterministic + interactive: the island **is** the serialized resolved deterministic context — same source of truth, no hand-authored twin, #1570-consistent.
- **Runtime injector hydration (#1827)** = non-deterministic: the only cell where the client must resolve the binding against live data.

**Precedence.** The typed JS property `.rows`/`.config` is **authoritative**; `rows="[[ ref ]]"` is the declarative path that sets that same property. An explicit imperative property set **wins over** a binding (a binding must no-op once the property has been set explicitly — the implementation must make a late-resolving async binding observe this, e.g. a "property set" flag). Raw author markup is **never** read as a data source by a render-from-data kernel — its kernel attaches a freshly-built tree via `host.replaceChildren(...)` (`fui:blocks/renderers/data-table/DataTableBehavior.ts:63`, where `renderDataTable()` returns a detached `<table>` built with `document.createElement('table')`, `fui:blocks/renderers/data-table/renderDataTable.ts:335`), so any parsed markup would be discarded. Markup-as-source remains exclusively the **light-DOM-scan** kernel's contract (#1570 scope guard); the two kernel shapes do not mix in one element.

## What #1570 already settled (do not re-open)

`#persistent-b-data-source` (ratified, lineage #1570 → `we:docs/agent/platform-decisions.md#persistent-b-data-source`) governs the property-vs-attribute-vs-markup choice for any render-from-data `we-` element: typed property is the floor; the optional declarative form is `[[ ref ]]` on the element's own attribute, resolved by reusing `we:plugs/webexpressions/CustomExpressionParser` against the **injector chain**; markup-parse is rejected for this kernel shape. This decision does **not** disturb any of that — it adds the **resolution-locus** dimension (server vs client, via determinism) and the **client-payload** dimension (via interactivity) on top of the single ratified form.

`.config` stays function-valued and so never serializes: `Column.format` (`fui:blocks/renderers/data-table/renderDataTable.ts:48`), `FilterPredicate.test` (`:63-68`), the `Intl.Collator`-backed `SortKey` (`:52-61`). The serialized **deterministic** payload therefore carries only the declarative subset (rows + `field`/`label`/`sortable`/`type`); function-valued options live only on the imperative `.config` path (apps).

## What this decision adds — the SSR / determinism axis

#1570's declarative form was specified for a live-JS runtime. The docs surface needs **server-rendered, zero-per-element-JS, accessible** tables. The unlock is that a deterministic binding **does not need a client runtime at all** — it resolves at build (DOM-free evaluator), emitting a real `<table>`. Correctness is preserved everywhere because the **server-resolved / serialized data carries the raw typed values**, so any client-side sort runs on raw `field` values — **nothing reparses rendered `<td>` text**. This closes the failure the prior framing missed: cells like `Baseline 2026` or `✅` (real in `fui:blocks/.../broadcast.njk`) sort wrong if you recover keys from rendered text, but are sorted correctly here because the typed value travels with the payload.

**New capability → #1827, app-facing.** Only the **non-deterministic** (client-only context) cell needs the injector chain seeded from runtime state. That is filed as **#1827 — SSR injector-context hydration**, general to every block's `[[ ref ]]` form, and is a `blockedBy` for the *app/dynamic* consumers — **not** for the docs `<table>` family, which is wholly deterministic and ships without it.

## Implementation residuals (open — goal is fixed, mechanism may flex)

These are deliberately left open for the build; they do not gate ratification of the rule above:
- **The determinism check** — what marks a context build-known vs client-only. Trivially deterministic for the Eleventy docs surface (all data is build data); the general predicate is the app concern (#1827).
- **The build-time evaluation harness** — how the Eleventy build invokes `CustomExpressionParser.evaluate()` with the build context to pre-render the `<table>` (a build integration, `we:` side).
- **The serialized-context format** — the exact shape of the inert `<script type="application/json">` resolved-context payload for the deterministic + interactive cell.

## Context

**Lineage / consumers.** Surfaced building #1787 (the data-table transient-CE embed entry, `fui:embed/data-table-in-document.ts`, in its `blockedBy`) — but the call is WE-layer. #1787 is the prerequisite for the #1600 table→data-table family (#1609 project-descriptions, #1610 plug-descriptions, #1611 adapter-descriptions + top-level, #1612 block-descriptions, #1613 research-descriptions — ~219 static `<table>` surfaces). Those are all **deterministic + (mostly) non-interactive** → they ship now on the build-resolved `<table>` path with no client payload and no #1827. Pattern siblings (scalar ingestion): badge embed #1758, code-view embed #1785.

**Reconciliation with `relatedReport`.** The prep report (`we:reports/2026-06-27-ssr-data-table-docs-ingestion.md`) recommended a typed `<script type="application/json">` island for the interactive case. This decision **subsumes** that, it does not contradict it: the island is precisely the **deterministic + interactive** cell of the matrix (the serialized resolved context). The report's table-reparse rejection also stands. What this generalizes beyond the report is (a) treating the island as a serialized *binding context* rather than a bespoke fourth form, and (b) collapsing the non-interactive case to a build-resolved `<table>` with no payload at all.

**Home on resolve.** Graduates to a new clause in `we:docs/agent/platform-decisions.md` extending `#persistent-b-data-source` with the determinism × interactivity matrix and the precedence rule — set `graduatedTo` / `codifiedIn`. No intent-registry edit: no WE intent owns "data table" vocabulary (`we:src/_data/intents/collection-operations.json` owns the filter/sort/group/page *operations*, `we:src/_data/intents/selection.json` owns row selection); a "declarative data-table ingestion subset" could later become a `collection-operations` dimension — a separate slice, not minted here.

**Supported by default (not a decision).** The imperative JS-property path (`.rows`/`.config`, full function-valued contract) is unaffected and remains the app path; this decision standardises the declarative/SSR resolution around it. Nothing is removed.
