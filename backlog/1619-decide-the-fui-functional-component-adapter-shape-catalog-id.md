---
kind: decision
parent: "081"
status: open
dateOpened: "2026-06-22"
dateStarted: "2026-06-23"
preparedDate: "2026-06-22"
relatedReport: reports/2026-06-22-fui-functional-component-adapter-shape.md
researchTopic: fui-functional-component-adapter-shape
relatedProject: webadapters
tags: [maas, polyglot, functional-component, adapter]
---

# Decide the FUI functional-component adapter shape: catalog identity vs the #977 functional retirement + #700 emit placement

No design exists for the FUI functional-component adapter yet — the plan
(`we:plans/functional-component-adapter.md`) is a brain-dump, and #1602 was mis-flagged as a mechanical
"register a FORMS entry." This prep traces the real tree and finds the adapter is **not greenfield**: WE's
reference `serve()` already emits the functional authoring source deterministically, and two of the three
"what you have to decide" points collapse to **forced invariants** already settled by ratified rulings
(#954/#956/#974). What remains is **two genuine forks**, each carrying a **bold** recommended default
grounded in the [research topic](/research/fui-functional-component-adapter-shape/) and
[report](../reports/2026-06-22-fui-functional-component-adapter-shape.md).

The concern decomposes into orthogonal axes, each pinned to verified `file:line`:

- **Authoring vs consume-mode catalog identity** — WE's authoring `functional` `ServeForm`
  ([`we:blocks/renderers/module-service/moduleService.ts:33`](../blocks/renderers/module-service/moduleService.ts#L33),
  `:56`) "lowers a `<component>` to a standard WC," whereas FUI's retired `functional` alias
  (`fui:tools/gen-wrapper/wrapperFormCatalog.mjs` `RETIRED_FORM_ALIASES`, `:64`) is
  a *consume-mode wrapper* ("wrap an existing WC **for** React"). Two artifact kinds, two id-spaces.
- **Emit placement (#700 / #954)** — WE's `serve()` already emits the functional source
  ([`we:blocks/renderers/functional/functionalComponent.ts:41`](../blocks/renderers/functional/functionalComponent.ts#L41)),
  committed to [`we:src/_data/authorModeSource.json`](../src/_data/authorModeSource.json) via the #954
  data-emit channel ([`we:blocks/renderers/module-service/authorModeSource.ts:55`](../blocks/renderers/module-service/authorModeSource.ts#L55)).
- **Served-module transpile** — the functional form is JSX (`loader:'jsx'`), non-import-able until
  transpiled through the injected `compilerRegistry`
  ([`we:blocks/renderers/module-service/moduleService.ts:211`](../blocks/renderers/module-service/moduleService.ts#L211)).
- **v1 render contract** — input = `<component>` definition, output = a `defineElement` JSX module against
  the existing `@frontierui/jsx-runtime` (`fui:packages/jsx-runtime/src/index.ts`).

## Recommended path at a glance

| Fork | recommended default | main alternative | confidence |
|---|---|---|---|
| 1 — catalog identity | **(a) new first-class authoring form id, distinct from the consume-mode wrapper catalog** | (b) un-retire `functional` (re-open #977) | med-high |
| 2 — served-JSX transpile owner | **(a) FUI injects a compiler at the served endpoint via the existing `compilerRegistry` seam** | (b) commit a pre-transpiled artifact as data | med-high |

## Fork 1 — Catalog identity of the authoring functional form

*Fork-existence:* real — one branch ((b) un-retire) is broken, and the survivors genuinely differ in the
WE→FUI catalog surface, so it is not support-both.

**Crux.** The authoring functional form needs a catalog identity, but the wire id `functional` is already
taken in FUI's **consume-mode** wrapper catalog as a retired alias →`react-wrapper`
(`fui:tools/gen-wrapper/wrapperFormCatalog.mjs` `:64`, `RETIRED_FORM_ALIASES`). That
catalog is a *different artifact kind* (wrap-a-WC-for-a-framework via `genWrapper`) from the authoring form
(lower-a-`<component>`-to-a-WC via `generateFunctionalSource`). Layer: a catalog value on the existing
catalog-gated `form` param (#974 A1) — **mechanism**, not UX-policy; `impl-is-not-a-standard` (WE owns one
neutral param; the value-set is the serving runtime's injected catalog).

- **(a) A new first-class authoring form id (keep WE's authoring `functional` `ServeForm` in the authoring
  id-space, wholly distinct from FUI's `WRAPPER_FORMS`).** *Recommended.* The authoring form keeps its id
  in the `FORMS` set + committed author-mode data; the #974/#977 consume-mode retirement is untouched. No
  id collision — the two ids live in disjoint catalogs reached by different endpoints. **Merit:** matches
  the unanimous prior art (Stencil functional-vs-`dist-custom-elements`, Mitosis authoring-source-vs-target,
  Svelte/Lit/Vue `defineCustomElement`) — one stable id per authoring form, never aliased onto a consume
  wrapper.
- **(b) Un-retire `functional` as an authoring member, re-opening #977.** *Rejected* — forces the one wire
  id to mean two things across two catalogs (authoring lowering vs React consume-wrapper), reintroducing
  exactly the ambiguity #977 removed; no prior-art system aliases an authoring form onto a consume wrapper.
- **(c) A separate, explicitly-named authoring catalog.** *Supported by default, not a rival* — describes
  the same end-state as (a) at a higher altitude; the authoring forms already live in a separate id-space.

**Recommended default: (a).** Confidence: **med-high** — prior art is unanimous; the only residual is a
cosmetic naming call (`functional` vs `functional-authoring` to pre-empt cross-catalog human confusion).

**Skeptic:** *"Two forms both called `functional` is a footgun — a caller requests the wrong one."*
SURVIVES — beat the attack: the two ids live in disjoint catalogs reached by **different endpoints** (the
author-mode data channel vs the genWrapper wrapper-serve endpoint), and the wrapper catalog serves the
retired alias as a deprecation *note*, not a 400; a caller of the authoring channel never sees
`WRAPPER_FORMS`. The cosmetic mitigation (`functional-authoring`) does not move the architecture.

## Fork 2 — Who transpiles the served JSX functional form

*Fork-existence:* real — both branches are coherent runtimes, but they cannot coexist (the served path has
one transpile owner); (b) is excluded on a concrete defect, not effort.

**Crux.** The served functional form is JSX (`loader:'jsx'`) and is non-import-able until transpiled
([`we:blocks/renderers/module-service/moduleService.ts:211`](../blocks/renderers/module-service/moduleService.ts#L211)
— *"a `jsx`-loader form MUST be transpiled to be an ES module"*). `serveCompiled` lowers it through the
**injected** `compilerRegistry`; "the delivery layer" registers the compiler.

- **(a) FUI injects a compiler at the served endpoint via the existing `compilerRegistry` seam.**
  *Recommended.* A runtime-DI seam the running standard already consults (`serveCompiled` reads
  `compilerRegistry.get()` at serve time), not a WE-side build. The FUI MaaS endpoint owns this transpile
  exactly as it owns `genWrapper` transpile today (#974 invariant 5). **Merit:** the author-mode *panel*
  still reads the WE-emitted JSX-*source* data (display); the *served, mountable* artifact is compiled at
  the endpoint — the natural data-emit-for-display / endpoint-for-execution split.
- **(b) Commit a pre-transpiled functional artifact as data.** *Rejected* — `transpileTarget` is a serve
  parameter ([`we:blocks/renderers/module-service/moduleService.ts:160`](../blocks/renderers/module-service/moduleService.ts#L160)),
  so committing one transpiled output fixes a dimension that must stay request-time-variable, and it
  duplicates the JS the FUI endpoint already produces in the wrapper path.

**Recommended default: (a).** Confidence: **med-high** — the `compilerRegistry` is an established
runtime-DI seam; aligning the functional served path to the same FUI-endpoint-owns-transpile rule as the
wrapper path is the consistent answer.

**Skeptic:** *"This makes the FUI endpoint depend on a compiler — heavier than shipping data."* SURVIVES —
beat the attack: the FUI MaaS endpoint **already** transpiles (the genWrapper `-live` forms bundle a
renderer + ErrorBoundary, transpiled today), so the JSX functional form rides the same already-present
capability and adds no new dependency class.

## Ratify (forced invariants — not forks)

- **Emit placement (#954 codified rule).** The functional authoring source is a **deterministic WE
  output**, so it rides the **data-emit** channel: WE's `serve()` emits it at build time into
  `we:src/_data/authorModeSource.json`; FUI's workbench/panel reads that data and never imports `serve()`.
  **Ratify:** #1602 is "wire a WE artifact + own the served-module transpile," **not** "build a FUI
  functional emitter." (FUI re-emit is broken — reverses #954-Fork1=A, #956=A, and #700/#707.)
- **v1 input/output contract.** **Ratify:** input = a `<component>` definition (`parseDefinition`); output =
  the JSX module `generateFunctionalSource` already emits (`export function <Name>()` + `class
  <Name>Element extends HTMLElement` mount wrapper + `defineElement(...)`, importing
  `@frontierui/jsx-runtime`). v1 = render-only; callbacks/effects/change-detection are later phases and a
  separate deep-research subject (candidate `customChangeDetectorRegistry`), out of scope.

## Context

Blocks #1602 (land the FUI functional-component adapter) → #313 (add it as a MaaS FORMS entry). Surfaced
during batch-2026-06-22-764-1602 pre-flight: the card read as a mechanical "register a FORMS entry," but
landing it forces unprepared design calls touching ratified decisions, so it could not be built without a
ruling. Once ruled, #1602 builds the adapter (per the "what #1602 becomes" steps in the report) and #313
registers it. The `@frontierui/jsx-runtime` runtime already exists (JSXRenderer + auto-define) — this
decides the *adapter/emit* layer around it, not the runtime.
