---
type: idea
workItem: story
size: 8
status: resolved
dateOpened: "2026-06-06"
dateStarted: "2026-06-06"
dateResolved: "2026-06-11"
graduatedTo: blocks/renderers/module-service/moduleService.ts
tags: [module-as-a-service, adapters, functional-component, plateau, dev-server, esm, render-strategy]
relatedProject: webadapters
crossRef: { url: /adapters/, label: Rendering Adapters }
---

# Module-as-a-Service — serve one component in any form, per request

A Plateau **provider that serves a single authored component in whatever form the consumer asks for** — original Web Component, functional-component (React-style) source, or any future shape — parameterized at request time (output form, `language`, transpile target, variant, …). It is the *serve-time* host of the same conversion machinery the **rendering adapters** run at build time, plus the **functional-component adapter** ([we:plans/functional-component-adapter.md](../plans/functional-component-adapter.md)). First cut is trivial: a single `render` returning the requested form. Reactivity is out of v1, folding into the `render-strategy` Protocol (#052/#077/#078). **Plateau must not reinvent the wheel** — it leverages existing service + compiler infrastructure.

The three things this item must reconcile are below.

## How it interacts — the three seams

| Seam | Build-time today | What MaaS adds (serve-time) | Tension to resolve |
|---|---|---|---|
| **Adapter-based demos** (source-toggle, [/adapters/](/adapters/)) | 11ty AST transformers convert HTML ⇄ JSX ⇄ template-string at build; the `html`/`jsx` source toggle is baked into the static page | Same transformer set, invoked **per request** with the *form* as a parameter instead of pre-rendered into the page | Demos prove the transform is correct *offline*; MaaS must reuse that exact transform code (one `webadapters` AST core), not a parallel copy — otherwise the served form drifts from the documented one |
| **Market compilers / dev servers** (Vite, esbuild, swc, tsc, webpack) | Each consumer project runs its own; our demos lean on the repo's 11ty + esbuild | MaaS exposes `transpileTarget` / `language` params and **delegates** to one of these as the service infra — "don't reinvent the wheel" | Embed a compiler in Plateau vs. shell out to existing infra; which one is canonical; how to stay a thin adapter over their output rather than a competing bundler |
| **Native-only imports** (no build step on the consumer) | [webinjectors](/projects/webinjectors/) exists to load deps "without build tools or import-maps limitations"; native `import` of plain WC works today | MaaS serves a URL the consumer `import`s natively — server applies the adapter transform so the client does zero build and still gets WC *or* functional form | Effectively an **ESM CDN with server-side adapter transforms**; must emit spec-clean ESM (bare-specifier / import-map story) so native-only consumers aren't forced back into a bundler — the very thing webinjectors set out to avoid |

## Why it's MaaS and not "just the adapters"

The rendering adapters answer *"can this tree be spelled three ways?"* (Axis 1 — pure, reversible spelling). MaaS answers *"who runs that conversion, when, and parameterized by what?"* It is a **host**, not a new transform: it should be a thin service that (a) resolves a component, (b) picks an adapter + render-strategy + transpile target from request params, (c) returns ESM the consumer imports natively. The conversion logic stays in `webadapters` (syntax) and the `render-strategy` Protocol (semantics, #052); MaaS owns only resolution, parameterization, caching, and delivery.

## Open decisions (recommendations in bold)

- **Compiler ownership.** **Delegate to existing infra (esbuild/swc as a service step), do not embed a bundler in Plateau** — matches the explicit "leverage existing service infrastructure." Hold open: a pluggable `customCompilerRegistry` so the transpile backend is itself swappable (mirrors the render-strategy registry pattern).
- **Form ↔ strategy coupling.** A "functional component" form implies a reactivity model, which is the **render-strategy axis (#052)**, not spelling. **MaaS should take *form* and *strategy* as independent params** and target the registry, so it never bakes in reactivity — same principle that keeps JSX from owning reactivity.
- **Native-import contract.** **Emit spec-clean ESM with an import-map story (lean on webinjectors), no consumer build step required.** This is the whole point of the native-only seam; bare-specifier resolution is the hard part.
- **Demo ↔ service single-source.** **The 11ty demos and MaaS must call one `webadapters` AST core**, so the toggle on a block page and the served artifact are provably the same transform — not two implementations that drift.

## Dependencies / sequencing

1. **Functional-component adapter** (WE spec + FU adapter) — the new *form* MaaS serves; v1 plan in [we:plans/functional-component-adapter.md](../plans/functional-component-adapter.md).
2. **Render-strategy Protocol** seam landing (#077 done, #078 lowering, #080 contract) — supplies the semantics axis MaaS parameterizes over.
3. **webadapters AST core** shared between demos and service — the no-drift guarantee.
4. Then MaaS itself: resolution + param plumbing + ESM/import-map delivery. v1 = a single `render`; callbacks/effects/change-detection are a later phase (`customChangeDetectorRegistry`, likely under the web-store project).

## Progress

- **Status:** resolved 2026-06-11 (see the close-out summary at the foot of this section). v1 + phases 2a/2b/2c landed and verified; the home decision is settled (under `webadapters`) and the non-blocking follow-ons spun out as #310–#313. Verified 2026-06-06: `we:moduleService.ts`, `we:tools/maas/vite-plugin.ts`, `we:functional/functionalComponent.ts`, both demos present; `we:moduleService.test.ts` 16/16 + full suite 1418 passing; `check:standards` 0 errors.
- **Branch:** docs/standard-authoring-workflow
- **Done (v1 skeleton — serve one component in N forms, single-core, native):**
  - **Resolver core** `we:blocks/renderers/module-service/moduleService.ts` — `serve(definition, { form })` returning `{ form, code, language, lossy, diagnostics }`, plus a `FORMS` catalog (`declarative` | `wc-class` | `html` | `jsx`). It owns **no transform** — it dispatches to the existing shared modules (`declarativeComponent.parseDefinition`/`generateClassSource`, `htmlToJsx`), which is the **anti-drift guarantee**: the served form is the same transform the [/adapters/](/adapters/) demos document, not a parallel copy.
  - **The reserved seam is honoured, not faked:** `transpileTarget` and `strategy` params are accepted but a non-default value raises a `Diagnostic` and sets `lossy:true` (never silently dropped) — that is exactly where the delegated compiler (phase 2) and the render-strategy axis (#052/#078) will plug in.
  - **Demo** `demos/module-as-a-service-demo.{ts,html,css}` — one card per shared component-case fixture (single-source with the conformance suite), a form toggle that re-`serve()`s on click, and a live pane that registers + renders the served WC form. The in-process resolver is the stub standing in for eventual ESM-over-HTTP delivery.
  - **Tests** `we:blocks/__tests__/unit/renderers/moduleService.test.ts` (10) — every form serves; wc-class/jsx/html assert byte-equality with the shared transforms (no drift); caller-error (unknown form / unparseable def) vs lossy-flag boundary pinned. Full renderer suite **170/170 green**; `tsc --noEmit` clean; `check:standards` 0 errors. Playwright smoke on the live demo: 8 cards × 4 forms render, 8 live elements upgrade, **zero console errors**.
- **Done (phase 2a — native ESM over HTTP):**
  - **Delivery endpoint** `we:tools/maas/vite-plugin.ts` (`moduleService()` Vite plugin, registered in `vite.config.mts`) — `GET /_maas/<name>.js?form=<form>` resolves the component (v1 registry = the shared component-cases fixtures, keyed by element name), runs the same `serve()` resolver under a transient linkedom `globalThis.document` (build-path parity with the 11ty `htmlToJsx` filter), and returns the result. `wc-class` → `text/javascript` (self-contained ESM that `customElements.define`s on import); 404 unknown component, 400 unknown form. The lossy contract is carried over the wire via `X-MaaS-Lossy` / `X-MaaS-Diagnostic` headers — never a silent drop.
  - **Consumer demo** `demos/maas-consumer-demo.{ts,html}` — a page with **no build step** that does a native `import('we:/_maas/user-card.js?form=wc-class')`; the module self-registers the element and it renders. Verified by Playwright: `customElements.get` false → import → true → shadow tree rendered, zero console errors. Both demos registered in `we:src/_data/demos.json` (so they surface on the demo index).
  - Full suite **1302 passing**; `tsc` clean; `check:standards` 0 errors.
- **Done (phase 2b — delegated transpile via a swappable compiler seam):**
  - **Compiler registry in the core** (`we:moduleService.ts`) — `CustomCompiler` contract + `CustomCompilerRegistry` + the `compilerRegistry` singleton, plus `async serveCompiled()` (= `serve()` + transpile). The core imports **no compiler** (stays browser-safe); the Node delivery layer registers an **esbuild**-backed provider into the seam — same inject-a-provider shape as `CustomRenderStrategyRegistry`. The render-strategy registry's "don't reinvent the wheel" applied to compilation.
  - **Endpoint** now takes `&target=<esbuild-token>` and serves the lowered JS for the JS forms; `es2015` compiles away private `#fields` / `??=` (esbuild helpers in the output). A non-JS form (`jsx`) or a missing/failing compiler is **flagged lossy, never silently passed** — esbuild failure falls back to untranspiled + a diagnostic.
  - **Fixed** a real wire bug: diagnostic strings carry em-dashes (non-ASCII) which throw in `res.setHeader` → spurious 500; `X-MaaS-Diagnostic` is now `encodeURIComponent`-encoded (consumer demo decodes it).
  - **Consumer demo** extended to fetch the same component at `target=es2015` and show the lowered self-contained source. Verified by Playwright: native import still registers + renders, the lowered pane shows esbuild helpers, zero console errors. Tests: `serveCompiled` covered (passthrough / no-compiler-flag / non-JS-flag / real-lowering via an injected fake) — **1306 passing**; `tsc` clean; `check:standards` 0 errors.
- **Done (phase 2c — functional-component form + the import-map seam):**
  - **Functional generator** `we:blocks/renderers/functional/functionalComponent.ts` (`generateFunctionalSource`) — lowers a `<component>` def to a React-style function returning JSX (via the shared `htmlToJsx`, so it mirrors the other forms) + a thin Custom Element wrapper that mounts it (shadow or light DOM). Added as the `functional` entry in `FORMS` (loader `jsx`, importable). The WE spec adapter `functional-component-adapter` bumped **concept → poc** with the POC shape documented (`we:adapters.json` + its description njk).
  - **Forced and solved the import-map seam.** The functional form is the **first served form that is not self-contained** — it imports the jsx runtime. Because a served module bypasses the consumer's dev-server/bundler import rewriting, an app-relative path 404s (confirmed live). The fix is the canonical native answer: the generator imports a **bare specifier** (`@frontierui/jsx-runtime`) and the consumer resolves it with an **import map**. The consumer demo carries the import map and imports a functional `<x-callout>`; Playwright-verified it registers + renders its shadow tree, **zero console errors**.
  - **Compiler seam extended to jsx:** `serveCompiled` keys off the form's `loader` — a `jsx` form *must* transpile to be import-able (always), a `js` form only on a non-default target. The esbuild provider passes `jsxFactory`/`jsxFragment` for the jsx loader.
  - **Shared-transform fix (benefits the whole JSX adapter):** `htmlToJsx` now emits raw-text elements (`<style>`/`<script>`) as a JSX string expression (`` <style>{`…`}</style> ``) — previously it produced unparseable JSX whenever CSS braces were present.
  - Full suite **1313 passing**; `check:standards` 0 errors; MaaS files `tsc` clean (pre-existing `src/cases/webinjectors/*` snippet errors are unrelated).
- **Status:** **resolved 2026-06-11** (`graduatedTo: module-service`) — MaaS v1 + phases 2a/2b/2c are landed and verified, and the **home decision is settled** (stays under `webadapters`). Per the 2026-06-10 split analysis (executed via #259), this is a **close-out, not an epic conversion**: v1 isn't unbuilt scope, so the four explicitly-non-blocking follow-ons were spun out as their own items rather than left as an oversized story.
- **Spun-out follow-ons (independent, not blocking — created 2026-06-11):**
  - **#310** — Reactivity (callbacks/effects/change-detection; the functional form renders once). Folds into the render-strategy Protocol (#052/#078) + a future `customChangeDetectorRegistry`.
  - **#311** — Real id→definition resolver + registry + caching (v1 resolves against the component-cases fixtures; this is the delivery hardening).
  - **#312** — Production runtime delivery (dev import map points at Vite-served `we:/blocks/renderers/jsx/index.ts`; a real deploy serves compiled `.js` + a published bare-specifier package; relates to module-resolution #271/#274 and importmap cleanup #285).
  - **#313** — Add the Frontier UI functional-component adapter as a new `FORMS` entry once it lands ([we:plans/functional-component-adapter.md](../plans/functional-component-adapter.md)).
- **Notes:** resolution source in v1 is the component-cases fixtures (the authored `<component>` text); the production registry/resolver is #311.

**Graduated to** `we:blocks/renderers/module-service/moduleService.ts` — Module-as-a-Service resolver core (webadapters).
