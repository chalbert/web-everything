---
kind: decision
size: 5
parent: "1600"
status: resolved
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
dateResolved: "2026-06-28"
graduatedTo: none
preparedDate: "2026-06-27"
relatedReport: reports/2026-06-27-ssr-data-table-build-harness-boundary.md
codifiedIn: "docs/agent/platform-decisions.md#ssr-data-table-build-harness"
tags: [data-table, ssr, build-integration, embed-boundary, webexpressions]
---

# DECISION: Build-time data-table ingestion harness — the WE→FUI evaluate/render boundary + the interactive-cell format

> **RESOLVED 2026-06-27.** Fork 1 → (a) FUI build-CLI subprocess (FUI-compute → WE-build, keyed-batch, version-pinned).
> Fork 2 → (c) `data-*`-on-cell + in-place DOM enhancer (no JSON island, no re-render — the build↔client skew class is
> structurally gone). Codified at `we:docs/agent/platform-decisions.md#ssr-data-table-build-harness`. Build graduates to
> **#1902**; the #1600 family (#1609–#1613) repointed there.

## Digest

The WE-side build residual of #1818 (`#block-data-ingestion`, ratified): WE's Eleventy build must pre-render a
`<we-data-table rows="[[ ref ]]">` binding into a plain SSR `<table>`, but the evaluator and renderer it needs
both live in **FUI**, and WE cannot code-import them (a WE→FUI code import is a banned backward DAG edge). So
"the Eleventy build invokes `evaluate()`" requires a **runtime/process boundary**, not a module import — and
*which* boundary (Fork 1) plus the **serialized-context format** five items inherit (Fork 2) are the two calls
#1818 deferred to the build. This is the **prerequisite for the entire #1600 table→data-table family** (#1609–#1613,
~219 static `<table>` surfaces): without it, `<we-data-table>` ships an empty surface.

## Axis-framing

Two halves of the harness are **FUI-resident** (confirmed: WE has **no `plugs/` source dir**; per #1282 zero-impl
WE holds no impl, and #1818's `we:plugs/...` citation predates the relocation):

- the evaluator — `evaluate(resolved: ResolvedValues): unknown`, **DOM-free**, where
  `ResolvedValues = { contexts: Record<string, unknown>; magic: Record<string, unknown> }`
  (`fui:plugs/webexpressions/CustomExpressionParser.ts:42-62`);
- the renderer — `renderDataTable(rows: Row[], config: DataTableConfig): HTMLTableElement`, **DOM-dependent**: it
  builds the tree with `document.createElement` (`fui:blocks/renderers/data-table/renderDataTable.ts:333-335`, `:279-326`),
  and FUI already runs it under a DOM shim in tests (`happy-dom`, `fui:vitest.config.ts:12`).

The cell contract is **JSON-native**: `Cell = string | number | null | undefined`
(`fui:blocks/renderers/data-table/renderDataTable.ts:33`); function-valued options (`Column.format` `:48`,
`FilterPredicate.test` `:63`, the `Intl.Collator`-backed `SortKey` `:52-61`) live only on the imperative `.config`
path and **never serialize** (settled by #1818). The DAG (`we:docs/agent/platform-decisions.md#constellation-placement`)
runs standard→WE→FUI; a code import backwards is banned, a process/origin boundary is not an edge.

Both forks are grounded against a published prior-art survey — see `relatedReport` and the `/research/` topic
[ssr-data-table-build-harness-boundary](/research/) — and reconciled against the statute field below.

## Recommended path at a glance

| Fork | Recommended default | Status |
| --- | --- | --- |
| **1 — evaluate/render boundary** | **(a) FUI build-CLI, batched one process (keyed-array in/out), harness re-homed to FUI** | **✅ RATIFIED 2026-06-27** — skeptic survived-with-amendment (version-pin, keyed-batch, direction-naming); (c) DAG-defeated, (b) killed by `#workbench-inert-data-static-slot` |
| **2 — interactive-cell payload format** | **(c) co-located `data-*` attrs on cells + in-place DOM enhancer (no re-render)** | **✅ RATIFIED 2026-06-27** — surfaced in discussion as the native-first third option; **dissolves the build↔client skew risk** (one rendered table, client reorders existing rows); (a) JSON-island and (b) input-context both retired as defaults |

### Supported by default (not forks)

- **The determinism predicate** (#1818 residual 1) — trivial for the Eleventy docs surface (all data is build-known);
  the general predicate is the *app* concern, already filed as #1827. No build-side fork.
- **The renderer's DOM environment** — the FUI-homed harness runs `renderDataTable` under FUI's existing DOM
  test-shim (`happy-dom`, `fui:vitest.config.ts:12`) and serializes `.outerHTML`, or FUI adds a string SSR variant;
  an impl detail *internal to the FUI harness*, not a WE-side fork. (The shim/serializer version is pinned — see Fork 1.)
- **Function-valued `.config` never serializes** — settled by #1818; the wire carries only the declarative subset.

## Fork 1 — the evaluate/render boundary mechanism — ✅ RATIFIED 2026-06-27 → (a)

**Ruling:** (a) FUI build-CLI, batched single process (keyed-array in / keyed-array out), harness re-homed to FUI
(`locus`/`relatedProject: frontierui`); WE's Eleventy orchestrates over the process boundary. Carries all three
skeptic amendments (locked FUI build-artifact version incl. DOM-shim/serializer, keyed-batch isolation, the
codified rule names the FUI-compute → WE-build direction and forbids the build reading the dev `/_maas/data/` route).

*Fork-existence: option (c) is the **excluded/broken** branch — a WE→FUI runtime dependency inverts the DAG (only
the type-only contracts package may cross WE→FUI), a forced invariant. (a) and (b) are two coherent branches that
**cannot coexist as the primary build transport** — the offline build crosses the boundary exactly one way.*

- **(a) FUI build-CLI the Eleventy build shells out to** *(default)* — deterministic context JSON in (stdin) →
  SSR `<table>` HTML out (stdout); the harness is **re-homed to FUI** (`relatedProject`/`locus: frontierui`); WE
  orchestrates over a process boundary. DAG-safe (process boundary, not a code edge), offline/hermetic (no server
  at build), deterministic. Cost: a typed CLI I/O contract + re-homing the harness.
- **(b) cross-origin / served** — FUI serves rendered tables over the #1499/#1731 MaaS data route; WE build fetches.
  DAG-safe and reuses the served-data pattern, but pulls a **running second origin** into a fundamentally offline build.
- **(c) published FUI runtime package WE's build depends on** — **rejected**: inverts the DAG.

**Prior art (decisive).** "Call logic you may not import" is solved canonically by a **CLI subprocess with a typed
stdin/stdout contract** — dart-sass's *Embedded Sass Protocol* (length-prefixed framed messages, optional host
callbacks), esbuild's subprocess service, the compiler-as-CLI pattern (tailwind/protoc). It severs the static import
edge while staying **hermetic + deterministic**. A build-time **fetch from a running server** is the documented
anti-pattern — Bazel's hermeticity literature flags network-during-build as breaking reproducibility. So (a) ≫ (b)
for an offline build. Within (a): a **batched one process** (no host callbacks needed — the build supplies the full
deterministic context) beats N cold-starts of a DOM shim across ~219 surfaces.

**Skeptic amendments folded in:** (i) the CLI is resolved as a **locked FUI build-artifact version** (incl. the
DOM-shim/serializer version), **never PATH-resolved** — else the build is non-reproducible; (ii) "batched" = **one
process, keyed-array in / keyed-array out**, so one malformed table's failure is isolated and attributable, not one
opaque blob; (iii) the rule's title must **name the direction (FUI-compute → WE-build)** so it does not read as
contradicting `#we-data-crosses-via-fui-served-route`, and must state **the build never reads the dev `/_maas/data/`
route** (that route is the dev-freshness seam per `#workbench-inert-data-static-slot`, not a build transport).

```jsonc
// stdin — one batched, keyed request the WE Eleventy build writes to the FUI build-CLI
{ "tables": [
  { "key": "src/_includes/plug-descriptions.njk#42",
    "context": { "datatable": { "rows": [ /* the deterministic resolved context */ ] } },
    "config":  { "columns": [ { "field": "name", "label": "Name", "sortable": true, "type": "string" } ] } }
] }
// stdout — keyed results, so a single table's failure is isolated, not the whole build
{ "tables": [
  { "key": "src/_includes/plug-descriptions.njk#42",
    "ok": true, "html": "<table class=\"data-table\" data-order=\"filter>sort>group>page\">…</table>" }
] }
```

**Skeptic: SURVIVES-WITH-AMENDMENT** — boundary direction is legitimate (the inverse of the banned edge);
folded the hermetic-version-pin, keyed-batch, and direction-naming amendments. No flip: (a) beats (b) on
hermeticity for an offline build; (b)'s only edge (dev freshness) is owned by a different seam.

## Fork 2 — the interactive-cell payload format — ✅ RATIFIED 2026-06-27 → (c)

**Ruling:** (c) co-located **`data-*` attributes on the SSR cells** + a small **in-place DOM enhancer** (client
sort/filter/page reorder the *existing* `<tr>`s; **no re-render, no JSON island**). Carries the **raw typed value**
on each cell (`<td data-sort-value="2026">`) so typed sort/group read a real key, never the display text. Live/app
data (the *full context hookup*) is the established **#1827** case and is explicitly out of scope here.

*Fork-existence: the **excluded/broken** branch is "recover sort keys from rendered `<td>` text" — a forced-invariant
violation of #1818's correctness rule (a key read from `Baseline 2026` / `✅` sorts wrong); (c) defeats it by carrying
the raw key in a `data-*` attr. The coherent branches are three ways to get the raw value to the client — on the cell
(c), in a co-located JSON blob (a), or as the un-projected input the client re-binds (b) — exactly one is emitted,
and five items (#1609–#1613) inherit it.*

- **(c) co-located `data-*` attrs + in-place enhancer** *(ratified)* — the SSR `<table>` **is** the table; raw typed
  values ride on the cells (`<td data-sort-value>`, `<th data-type="number" data-sortable>`); a small client enhancer
  reorders/hides the existing rows. **No second render path → the build↔client skew risk is structurally gone** (only
  one rendered table ever exists). Native-first (rule 75): plain HTML, inspectable, survives DOM moves, no `:scope >`
  island bookkeeping. Cost: a small **in-place enhancer** distinct from `renderDataTable` (which builds *from* rows and
  cannot operate on a DOM it did not create); **grouping** in-place (insert group-header rows, recompute aggregates) is
  fiddlier than via re-render — acceptable since the docs/backlog surfaces are sort/filter, not group-heavy.
- **(a) evaluated-result JSON island + re-render** *(retired)* — nested-child `<script type="application/json">`
  carrying raw `rows` + declarative `config`; client `JSON.parse` → `renderDataTable`. Reuses the renderer, but ships a
  duplicate payload **and** introduces *two* render paths (build SSR vs client re-render) that must be version-pinned or
  every table silently reflows on hydration — the skew risk (c) avoids entirely.
- **(b) ship the raw input context** *(retired)* — client re-runs `evaluate()` to re-bind: ships the un-projected input
  and re-runs evaluation client-side (skew). This is really the live-context shape — it belongs to #1827, not here.

**Prior art.** Carrying the sort key on the cell as a `data-*` attribute and enhancing the existing table in place is the
canonical progressive-enhancement pattern (GOV.UK `moj-sortable-table` `data-sort-value`, WHATWG/HTML `sortable` lineage,
classic `tablesorter`). Islands frameworks **co-locate** the hydration data with the element — (c) takes that to its
native limit: the data co-locates *on the cells themselves*, no separate payload node. The `data-*` value is the
**derived projection** of the `[[ ref ]]` + `config` authoring SoT (`#single-authoring-sot-derived-projection`); the SSR
text and the sort key are two faces of the *same* build-time projection — one authoring home, one render.

```html
<!-- (c) ratified: raw typed values on the cells; the SSR table IS the table, client reorders it in place -->
<we-data-table data-order="filter>sort>group>page">
  <table class="data-table">
    <thead><tr>
      <th data-field="name"  data-type="string" data-sortable>Name</th>
      <th data-field="since" data-type="number" data-sortable>Since</th>
    </tr></thead>
    <tbody>
      <tr><td data-sort-value="webcards">webcards</td><td data-sort-value="2026">Baseline 2026</td></tr>
    </tbody>
  </table>
</we-data-table>
<!-- enhance: read data-sort-value (raw key, NOT the "Baseline 2026" text), reorder existing <tr>s in place -->
```

**Skeptic: SURVIVES-WITH-AMENDMENT** — the strongest case against (c) is owning a *second* client engine (the in-place
enhancer) and in-place **grouping** being fiddlier than re-render. Folded amendments: (i) the enhancer is **FUI-homed**
(it is the `<we-data-table>` CE's own client behavior — the renderer's sibling, not a WE concern); (ii) it is the
**sole** client path (no `renderDataTable` re-render on the client), which is precisely what removes the skew class;
(iii) if a docs surface ever needs heavy in-place grouping and that proves too costly, *that specific surface* may opt
into an island — a localized exception, not a reopening of the default. No flip: (c) dominates (a)/(b) on skew-safety and
native-first, and the raw-key-on-cell satisfies #1818's raw-values correctness rule.

## Statute-overlap reconciliation (for any eventual `codifiedIn`)

No collision; a narrow extension that **composes** with the field:

- **`#we-data-crosses-via-fui-served-route`** governs the **inverse** direction (WE-owned data → FUI *runtime*, via
  build-emit + served route). #1867 is FUI-owned compute → WE *build*, via a **subprocess, not a served route** —
  the offline-build sibling. The new rule must **name its direction** so it does not read as contradicting the
  served-route anchor (the skeptic's explicit caution).
- **`#workbench-inert-data-static-slot`** already ruled the served route is the **dev-freshness seam, not the primary
  transport** for inert display data — SSR `<table>` HTML is inert display data, so this anchor **kills Fork 1 (b)
  and protects (a)**, and the build must never read the dev route.
- **`#block-data-ingestion`** (#1818) — #1867 *fills* its three named-open residuals (determinism predicate / build
  harness / serialized-context format); it does **not** re-decide the determinism×interactivity rule.
- **`#single-authoring-sot-derived-projection`** — Fork 2's cell `data-*` values are the derived projection; the
  `[[ ref ]]` + config remain the single authoring SoT, and the SSR cell text + its raw `data-sort-value` are emitted
  from that one projection in a single build pass (Fork 2 residual-risk mitigation).

## Most dangerous residual risk (carry to the build)

The original skew risk — *build-vs-client render through two independently-pinned renderers* — is **dissolved by Fork 2
(c)**: there is now only **one** rendered table (the SSR `<table>`); the client reorders the existing rows in place and
never re-renders, so two render paths cannot drift. That was the prepared default's biggest worry and (c) removes the
whole class.

The residual that remains is narrower: **the build's SSR `<td>` text and the cell's `data-sort-value` are two faces of
one projection and must stay consistent** — if the display text is formatted (`Baseline 2026`) but the raw key
(`2026`) is stamped by a different code path, a typed sort could disagree with what the user reads. **Mitigation (build
rule): a single build-time emit produces both the cell text and its `data-*` raw value from the same resolved row — one
projection, two attributes — never two passes.** Lower-severity than the retired skew class (it is build-internal and
unit-testable, not a silent client-only reflow).

## Lineage

Parent #1600 (table→data-table family). WE-side build residual of #1818 (`we:docs/agent/platform-decisions.md#block-data-ingestion`).
PREREQUISITE for #1609–#1613. #1787 delivered only the runtime transient-CE embed + `we-data-table{}` CSS baseline —
NOT this harness; the family's `blockedBy: [1787]` edges were false and are repointed here. The non-deterministic
(app) case is #1827, out of this item's scope.
