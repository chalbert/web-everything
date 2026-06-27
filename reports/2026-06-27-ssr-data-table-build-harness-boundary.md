# SSR data-table build harness — the WE→FUI evaluate/render boundary + the serialized-context format

**Date:** 2026-06-27 · **Grounds:** decision [#1867](/backlog/1867-build-time-data-table-ingestion-harness-eleventy-resolves-ro/) (WE-side build residual of #1818, under epic #1600) · **Status:** prep (decision still open)

## Why this decision exists

[#1818](/backlog/) ratified `#block-data-ingestion`: a render-from-data `we-` block sources its complete data from **one** declarative form — `rows="[[ ref ]]"` binding to a context — and a deterministic binding **resolves at build time** into a plain `<table>`. #1818 deliberately left **three implementation residuals** open (mechanism may flex, goal fixed): the determinism predicate, the **build-time evaluation harness**, and the **serialized-context format**. #1867 is the WE-side build residual: nothing in WE's Eleventy build yet invokes the evaluator to pre-render the binding, and it is the **prerequisite for the entire #1600 table→data-table family** (#1609–#1613, ~219 static `<table>` surfaces).

The story-as-filed assumed WE imports the evaluator/renderer. Grounding the tree dissolved that premise and surfaced the real fork.

## Grounding (what the tree actually says)

- **WE has no `plugs/` source dir** (confirmed: `ls plugs/` → absent). Per #1282 zero-impl, WE holds no impl. The #1818 citation of `we:plugs/webexpressions/...` predates the FUI relocation.
- Both halves of the harness are **FUI-resident**:
  - Evaluator — `evaluate(resolved: ResolvedValues): unknown` is **DOM-free**; `ResolvedValues = { contexts: Record<string, unknown>; magic: Record<string, unknown> }` (`fui:plugs/webexpressions/CustomExpressionParser.ts:42-62`).
  - Renderer — `renderDataTable(rows: Row[], config: DataTableConfig): HTMLTableElement` is **DOM-dependent**: it builds the tree with `document.createElement` (`fui:blocks/renderers/data-table/renderDataTable.ts:333-335`, `:279-326`). FUI already runs it under a DOM shim in tests (`happy-dom`, `fui:vitest.config.ts:12`).
- **The cell contract is JSON-native:** `Cell = string | number | null | undefined` (`fui:blocks/renderers/data-table/renderDataTable.ts:33`). Function-valued options (`Column.format` `:48`, `FilterPredicate.test` `:63`, the `Intl.Collator`-backed `SortKey` `:52-61`) live only on the imperative `.config` path and **never serialize** (settled by #1818).
- **DAG:** standard→WE→FUI. A WE→FUI **code import** is a banned backward edge; a **runtime/process boundary** (cross-origin / CLI subprocess) is **not** an edge. So "the Eleventy build invokes `evaluate()`" needs a boundary, not an import.

## The two forks

### Fork 1 — the evaluate/render boundary mechanism

WE's offline Eleventy build cannot code-import the FUI evaluator/renderer. Options:

- **(a) FUI build-CLI the Eleventy build shells out to** — deterministic context JSON in (stdin) → SSR `<table>` HTML out (stdout); one batched invocation per build; no host callbacks. The harness is **re-homed to FUI** (`locus: frontierui`); WE orchestrates over a process boundary.
- (b) cross-origin / served — FUI serves rendered tables over the #1499/#1731 MaaS data route; WE build fetches.
- (c) published FUI runtime package WE's build depends on — **rejected**, inverts the DAG (only the type-only contracts package may cross WE→FUI).

**Prior-art finding (decisive).** The "call logic you may not import" problem is solved canonically by a **CLI subprocess with a typed stdin/stdout contract** — dart-sass's *Embedded Sass Protocol* (length-prefixed framed messages, protobuf payload, optional host callbacks), esbuild's subprocess service, the general compiler-as-CLI pattern (tailwind, protoc: input via flags/stdin, output to stdout, exit code = status). It **severs the static import edge while staying hermetic and deterministic**. A build-time **fetch from a running server** is the documented anti-pattern: Bazel's hermeticity literature flags network access during a build as breaking determinism ("given the same inputs, always returns the same output" requires isolation from ambient/host state). Sources: [Embedded Sass protocol](https://github.com/sass/sass/blob/main/spec/embedded-protocol.md), [sass-embedded](https://www.npmjs.com/package/sass-embedded), [Bazel hermeticity](https://bazel.build/basics/hermeticity), [Tweag: hermetic Bazel](https://www.tweag.io/blog/2022-09-15-hermetic-bazel/).

Within (a), the I/O shape is itself a sub-choice: a **batched one-shot** (all bindings in, all tables out, one process per build — no callbacks needed because the build supplies the full deterministic context) vs a dart-sass-style **long-lived framed service** (amortizes spawn cost, enables host callbacks). For ~219 build-known surfaces with no callbacks, batched one-shot is the simpler hermetic default.

### Fork 2 — the serialized-context format

The inert `<script type="application/json">` payload for the **deterministic + interactive** cell (build-resolved baseline that the client re-renders on sort/filter). Options:

- **(a) ship the evaluated result** — resolved `rows` + the declarative `config` subset (field/label/sortable/type) as plain JSON, **co-located with the element as a nested-child `<script type="application/json">`** inside the `<we-data-table>` (structural association, no id bookkeeping), carrying **raw field values** (not formatted display text). Client re-renders directly.
- (b) ship the raw **input context** map; client re-runs `evaluate()` to re-bind.

**Prior-art finding.** Islands frameworks **co-locate the hydration payload with the element instance** — Astro's `props` attribute on `<astro-island>`, Eleventy `<is-land>`'s nested `<template>`, Lit SSR's declarative-shadow-DOM — rather than one page-global blob (`__NEXT_DATA__`, Qwik's resume graph). A **type-preserving codec** (devalue in Nuxt/SvelteKit, superjson's `{json, meta}`, Remix's turbo-stream) is needed **only when non-JSON-native values cross** (`Date`/`BigInt`/`Map`/`undefined` don't round-trip bare `JSON.stringify`; `BigInt` throws). **WE's `Cell` contract is JSON-native primitives**, so plain JSON is sufficient — *with a guard*: widening `Cell` beyond JSON-native would force a codec. The correctness invariant from #1818 (sort runs on raw `field` values, never reparsed `<td>` text) is satisfied by shipping raw field values regardless of (a)/(b). Sources: [devalue](https://github.com/nuxt-contrib/devalue), [superjson](https://github.com/flightcontrolhq/superjson), [Astro islands](https://docs.astro.build/en/concepts/islands/), [Eleventy is-land](https://www.11ty.dev/docs/plugins/is-land/), [Lit SSR](https://lit.dev/docs/ssr/client-usage/).

## Per-fork classification (7-question pass)

| Q | Fork 1 (boundary) | Fork 2 (payload format) |
|---|---|---|
| Which layer? | WE build-integration crossing to FUI impl (constellation/build placement, not a standard layer) | the wire surface of `#block-data-ingestion` (a derived projection of the resolved context) |
| Protocol / intent dimension? | neither — a build-tool process boundary | neither — a serialization wire-form, not a new protocol |
| Expose the whole axis? | no — one boundary for the one hermetic docs build; the runtime axis is separately #1827 | expose only the declarative subset; functions stay off-wire (settled) |
| Fixed mechanic or dimension? | fixed mechanic (one offline end-state); contrast `#config-extends-platform-default` (which is for multi-end-state concerns) | fixed wire-form (one contract #1609–#1613 inherit) |
| DI-injectable? | **devtools provider seam**, not a runtime registry — build-time invocation per `#runtime-di-vs-devtools-provider-seam` | n/a (data, not a provider) |
| Most-permissive default? | most-hermetic/offline (CLI; no running origin) | ship nothing unless interactive; minimal raw-typed payload (the #1818 matrix) |
| Seam between intents? | no — single concern | no |

## Statute-overlap reconciliation (for any eventual `codifiedIn`)

- **`#we-data-crosses-via-fui-served-route`** governs the **inverse** direction (WE-owned data → FUI runtime, via build-emit + served route). #1867 is FUI-owned compute → WE *build*. **No collision**: it is the offline-build sibling. A served route (that anchor's transport) would inject a running origin into WE's hermetic build — which the next anchor already demoted.
- **`#workbench-inert-data-static-slot`** already ruled that for **inert** derived display data the static/build path is the **primary transport** and the served route is only the **dev-freshness seam**. SSR `<table>` HTML is inert display data → this anchor **directly supports Fork 1 (a)** over (b).
- **`#block-data-ingestion`** (#1818) — #1867 fills its named-open residuals; it does **not** re-decide the determinism×interactivity rule. Composes by construction.
- **`#single-authoring-sot-derived-projection`** — Fork 2's payload must stay a **derived projection** (regenerated each build from the binding), never a second authoring home. The default honors this; the binding remains the single SoT.

**Net:** if #1867 codifies anything, it is a narrow extension — "FUI-owned build-time compute crosses to WE's offline build via a process-boundary CLI (the hermetic, offline analogue of `#we-data-crosses-via-fui-served-route`); never a WE→FUI code import, never a running origin at build." This **composes with**, and does not duplicate, the served-route anchor (different direction, different consumer: a build, not a runtime).

## Recommended path at a glance

| Fork | Recommended default | Confidence |
|---|---|---|
| 1 — boundary | **(a) FUI build-CLI, batched one-shot, harness re-homed to FUI** | medium — (c) DAG-defeated; (a) vs (b) is hermetic-build-vs-reuse-served-path, and prior art + `#workbench-inert-data-static-slot` both favor (a) |
| 2 — payload format | **(a) evaluated-result, nested-child inert JSON, raw field values, plain JSON over the JSON-native `Cell`** | medium — five items inherit it; the JSON-native `Cell` removes the codec question, leaving carries-result-vs-context + anchoring |
