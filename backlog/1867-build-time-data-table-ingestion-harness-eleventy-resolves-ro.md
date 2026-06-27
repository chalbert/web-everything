---
kind: decision
size: 5
parent: "1600"
status: active
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
preparedDate: "2026-06-27"
relatedReport: reports/2026-06-27-ssr-data-table-build-harness-boundary.md
tags: [data-table, ssr, build-integration, embed-boundary, webexpressions]
---

# DECISION: Build-time data-table ingestion harness — the WE→FUI evaluate/render boundary + the serialized-context format

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

| Fork | Recommended default | Confidence |
| --- | --- | --- |
| **1 — evaluate/render boundary** | **(a) FUI build-CLI, batched one process (keyed-array in/out), harness re-homed to FUI** | medium — (c) DAG-defeated; (a) vs (b) is a hermetic-build-vs-reuse-served-path trade. Prior art (dart-sass / Bazel) **and** `#workbench-inert-data-static-slot` both favor (a) |
| **2 — serialized-context format** | **(a) evaluated-result payload, nested-child inert `<script type="application/json">`, raw field values, plain JSON over the JSON-native `Cell`** | medium — five items inherit it; the JSON-native `Cell` removes the codec question, leaving carries-result-vs-context + anchoring |

### Supported by default (not forks)

- **The determinism predicate** (#1818 residual 1) — trivial for the Eleventy docs surface (all data is build-known);
  the general predicate is the *app* concern, already filed as #1827. No build-side fork.
- **The renderer's DOM environment** — the FUI-homed harness runs `renderDataTable` under FUI's existing DOM
  test-shim (`happy-dom`, `fui:vitest.config.ts:12`) and serializes `.outerHTML`, or FUI adds a string SSR variant;
  an impl detail *internal to the FUI harness*, not a WE-side fork. (The shim/serializer version is pinned — see Fork 1.)
- **Function-valued `.config` never serializes** — settled by #1818; the wire carries only the declarative subset.

## Fork 1 — the evaluate/render boundary mechanism

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

## Fork 2 — the serialized-context format

*Fork-existence: the **excluded/broken** branch is "recover sort keys from rendered `<td>` text" — a forced-invariant
violation of #1818's correctness rule (a key read from `Baseline 2026` / `✅` sorts wrong). The two coherent branches
that cannot coexist as one wire-form: ship the **evaluated result** vs ship the **raw input context** — exactly one
payload shape is emitted, and five items (#1609–#1613) inherit it.*

The inert `<script type="application/json">` payload for the **deterministic + interactive** cell (build-resolved
baseline the client re-renders on sort/filter):

- **(a) ship the evaluated result** *(default)* — resolved `rows` + the declarative `config` subset
  (`field`/`label`/`sortable`/`type`) as **plain JSON**, **co-located as a nested-child** `<script type="application/json">`
  inside the `<we-data-table>` (structural association — no id bookkeeping, survives DOM moves), carrying **raw field
  values** (not formatted display text). Client re-renders directly via `renderDataTable`.
- **(b) ship the raw input context** map; the client re-runs `evaluate()` to re-bind. "Same source of truth" phrasing,
  but ships the binding + the (potentially larger) un-projected input context, and re-running `evaluate()` on the
  client risks build≠client skew.

**Prior art.** Islands frameworks **co-locate the hydration payload with the element instance** (Astro's `props`
attribute, Eleventy `<is-land>`'s nested `<template>`, Lit SSR's declarative shadow DOM) rather than a page-global
blob (`__NEXT_DATA__`, Qwik). A **type-preserving codec** (devalue, superjson, turbo-stream) is needed **only for
non-JSON-native values** — WE's `Cell` is JSON-native, so plain JSON suffices. (a) wins on payload minimality, not
leaking un-projected source data, and build-once determinism.

**Skeptic amendments folded in:** (i) the no-codec rule is **conditional** — plain JSON *iff* the projected value set
is JSON-total; **widening `Cell` beyond JSON-native triggers a codec decision**, it does not silently widen the format;
(ii) the nested `<script>` is **non-slotted** and read via **direct-child query, not descendant** (so a nested table
doesn't grab the wrong payload, and shadow-DOM slotting doesn't capture it); (iii) **one formatter, one pinned
`renderDataTable`** — the SSR `<table>` text is the serialized output of the *same* renderer the client hydrates with,
so the cell text never reflows on hydration. Per `#single-authoring-sot-derived-projection`, the JSON is the **derived
projection** of the `[[ ref ]]` + `config` authoring SoT, and the SSR text is rendered *from it* — one authoring home.

```html
<!-- (a) default: evaluated-result payload as a NON-SLOTTED, direct-child inert island -->
<we-data-table>
  <table class="data-table" data-order="filter>sort>group>page"> … server-rendered baseline … </table>
  <script type="application/json" data-we-data-table="resolved">
    { "rows":   [ { "name": "webcards", "since": 2026 } ],          /* RAW field values, not "Baseline 2026" */
      "config": { "columns": [ { "field": "name", "label": "Name", "sortable": true, "type": "string" },
                               { "field": "since", "label": "Since", "sortable": true, "type": "number" } ] } }
  </script>
</we-data-table>
<!-- hydration: querySelector(':scope > script[data-we-data-table]'), JSON.parse, renderDataTable(rows, config) -->
```

**Skeptic: SURVIVES-WITH-AMENDMENT** — folded the JSON-total conditional, non-slotted/direct-child rule, and the
one-renderer-no-skew constraint. No flip: ship-result beats ship-context on minimality, leakage, and determinism;
raw-values is the correctness requirement (#1818), not negotiable.

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
- **`#single-authoring-sot-derived-projection`** — Fork 2's JSON is the derived projection; the `[[ ref ]]` + config
  remain the single authoring SoT, and SSR text is rendered from the projection (one formatter — Fork 2 amendment iii).

## Most dangerous residual risk (carry to ratification)

**Build-vs-client render skew through two independently-pinned renderers.** Fork 1 pins a DOM-shim serializer in the
FUI build-CLI to emit SSR HTML; Fork 2 hydrates with `renderDataTable` in a real browser. Nothing *automatically*
forces those two render paths to be the same code at the same version — if they drift, every interactive table
silently reflows on hydration, a correctness bug that passes every build gate because each side is internally
consistent. **Mitigation (must be in the ratified rule): the build-CLI and the client runtime are the same pinned FUI
version, and SSR text is the serialized output of the same `renderDataTable` the client hydrates with — one renderer,
two execution contexts, never two renderers.**

## Lineage

Parent #1600 (table→data-table family). WE-side build residual of #1818 (`we:docs/agent/platform-decisions.md#block-data-ingestion`).
PREREQUISITE for #1609–#1613. #1787 delivered only the runtime transient-CE embed + `we-data-table{}` CSS baseline —
NOT this harness; the family's `blockedBy: [1787]` edges were false and are repointed here. The non-deterministic
(app) case is #1827, out of this item's scope.
