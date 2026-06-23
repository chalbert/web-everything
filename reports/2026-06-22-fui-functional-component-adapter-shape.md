# FUI functional-component adapter shape — decision-prep (#1619)

**Date:** 2026-06-22 · **Item:** [#1619](../backlog/1619-decide-the-fui-functional-component-adapter-shape-catalog-id.md) · **Blocks:** #1602 → #313 · **Parent epic:** #081

## The question

#1602 ("land the FUI functional-component adapter") reads as a mechanical "register a FORMS entry,"
but pre-flight surfaced that landing it touches a **ratified** decision (#974/#977) and a **codified**
constellation rule (#954). #1619 was filed to rule three "what you have to decide" points:

1. **Catalog identity** vs the #974/#977 `functional`→`react-wrapper` retirement.
2. **#700 emit placement** — FUI re-emit vs consume WE's data-emit.
3. **Adapter input/output contract** — pin v1.

This prep traces the real tree and finds that **two of the three collapse to forced
invariants** already settled by ratified rulings; the only genuine open call is catalog identity, and even
that has a strongly-recommended default with prior art behind it.

## The real tree (grounding)

### WE already emits the functional authoring source

`we:blocks/renderers/module-service/moduleService.ts:33` declares the `ServeForm` union as
`'declarative' | 'wc-class' | 'html' | 'jsx' | 'functional'`, and `:56` registers the `functional`
descriptor (`label: 'Functional component', language: 'jsx', loader: 'jsx', importable: true`). The
dispatch at `:185` calls `generateFunctionalSource(parseDefinition(definition))`.

`we:blocks/renderers/functional/functionalComponent.ts:41` is that generator. From a `<component>`
definition it emits (a) a `export function <Name>()` returning the template as JSX (via `htmlToJsx`,
`:44`), (b) a thin `class <Name>Element extends HTMLElement` wrapper that mounts it (`:68`), and (c) the
literal `defineElement('<name>', <Name>Element)` self-registration (`:75`). The module imports the jsx
runtime from a **bare specifier** `'@frontierui/jsx-runtime'` (`JSX_RUNTIME_SPECIFIER`, `:25`). The
file header (`:5-9`) states explicitly: *"The WE spec is the `functional-component` Syntax Adapter
(/adapters/); this is the (Frontier-UI-side) generator that realises it."* It owns no parsing — it
reuses `htmlToJsx`, so the functional form **provably mirrors** the same tree as wc-class / html / jsx
(no drift).

So the "FUI functional adapter" is **not greenfield**. The lowering already exists in WE's reference
`serve()`, deterministically, and is exercised by 9 cases in committed author-mode data
(`we:src/_data/authorModeSource.json` carries 9 `"form": "functional"` entries).

### The consumed runtime already exists in FUI

`fui:packages/jsx-runtime/src/index.ts` re-exports `jsx` / `createElement` / `Fragment` from
the FUI `JSXRenderer` (a DOM-building JSX factory — real DOM, not a vtree) and `defineElement` /
`explicitAutoDefine` from `fui:packages/jsx-runtime/src/auto-define.ts`.
`fui:packages/jsx-runtime/dist/auto-define.d.ts` documents that `defineElement` is *"the one call every
module makes (generated OR hand-authored)"* — idempotent, collision-safe, HMR-safe via a
`customElements.get(tag)` guard. The header notes this is the **published-package copy** of the canonical
`we:blocks/renderers/auto-define/defineElement.ts` (WE #244), carried in *"the same way the FUI
`JSXRenderer` was"*. So the served functional module's
`import jsx, { defineElement } from '@frontierui/jsx-runtime'` resolves against a real, shipping package.

### The retirement is consume-mode-only

`fui:tools/gen-wrapper/wrapperFormCatalog.mjs` is FUI's injected `form` catalog for the **MaaS
wrapper-serve** path (#977). Its `WRAPPER_FORMS` are `<target>-wrapper` / `<target>-live` entries, each
mapping a wire `form` string to `genWrapper(cem, target, variant)` — i.e. *"wrap an existing WC **for** a
framework"* (consume-mode; `react`/`vue` host renderer supplies the runtime). Its `RETIRED_FORM_ALIASES`
folds `functional → react-wrapper`, with the rationale (header + `:64`): *"the legacy WE reference form
`functional` … is **accidentally React-only** and predates the polyglot generator."* The retired-alias
folding (`resolveWrapperForm`, `serveWrapperForm`) lives entirely inside this consume-mode catalog. The
retirement was a statement about **consume-mode wrapper identity**, not about the authoring form.

### The emit-placement rule is already codified (#954)

#954 ("how the FUI polyglot panel consumes WE-side artifacts") ratified and **codified**
(`codifiedIn: we:docs/agent/platform-decisions.md#constellation-placement`) the rule:

> *deterministic WE outputs → data-emit (commit output, panel reads); verdicts that depend on FUI's live
> output → vectors-as-data + runner-runs-FUI-side. The standard/engine never leave WE; only outputs and
> standard-artifacts cross WE→FUI.*

Fork-1 of #954 ruled the author-mode `serve()` source = **A, data-emit** (WE runs `serve()` at build
time, commits `{code, language, lossy, diagnostics}` as JSON to `we:src/_data/authorModeSource.json`;
FUI reads it). The functional form is **part of that exact emit** (`projectCaseForms` in
`we:blocks/renderers/module-service/authorModeSource.ts:55` maps over **every** `FORMS` descriptor,
including `functional`). B (FUI ports `serve()`) was ruled *broken* (reverses #956=A, #700/#707-forbidden,
diverges from `FORMS`).

## Prior-art survey — authoring form vs consume wrapper, and catalog identity

Every analogous compile-time system keeps the **authoring source** and the **emitted/wrapped element** as
distinct, first-class catalog entries — an authoring form is never an alias of a consume-mode wrapper:

- **Stencil.** A *functional component* is a pure function `(props) => JSX` that the JSX compiler inlines;
  it is explicitly *"quite different to normal Stencil web components … part of Stencil's JSX compiler."*
  The shipped *custom element* is a separate **output target** (`dist-custom-elements` — a stand-alone
  `class extends HTMLElement` with styles attached). Authoring form (functional) and emitted element
  (custom-element output) are two distinct artifacts produced from the **same source** — the same
  authoring-vs-emit split WE has between the `<component>` definition and the served `functional` module.
- **Mitosis.** Parses a static-JSX-subset `.lite.jsx` *authoring source* into a framework-agnostic JSON
  AST, then compiles to a chosen **output target** (`--to=webcomponents` → vanilla custom elements;
  `--to=react`/`vue` → framework components). Authoring source and each emitted target are distinct
  identities selected by an explicit target flag — never collapsed.
- **Svelte / Lit / Vue defineCustomElement.** Each authors in its own dialect and emits a custom element
  via an explicit opt-in (`customElement: true`, `@customElement`, `defineCustomElement`). The authored
  form and the emitted element are separate; a consume-mode framework *wrapper* (e.g. `@lit/react`) is yet
  a third, separately-identified artifact.

**Takeaway:** the catalog-identity practice across the field is *one stable id per authoring form*, kept
distinct from consume-mode wrapper ids. Folding an **authoring** form into a **consume** wrapper alias —
which is what un-retiring `functional` into the `react-wrapper`-aliased slot would do — has **no prior-art
support** and conflates two different artifact kinds. This is the load-bearing finding for Fork 1.

## Fork-by-fork classification

### "Decide-point" 1 — catalog identity → GENUINE FORK (Fork 1)

The authoring functional form needs a catalog identity, and there are coherent options (new first-class
id, un-retire `functional`, separate authoring catalog). One branch is broken (un-retire — see Fork 1),
the survivors genuinely differ in WE→FUI surface, so this is a real fork. Layer: this is a **catalog
value** on the existing `form` param (a Block-renderer / MaaS concern), **mechanism** (which id resolves
to which transform), not UX-policy. `impl-is-not-a-standard` holds: WE owns one neutral catalog-gated
param; the value-set is the serving runtime's injected implementation catalog (#974 A1).

### "Decide-point" 2 — #700 emit placement → FORCED INVARIANT (no fork)

Run the fork-existence test: branch B (FUI grows its own functional emitter) is **broken** — it reverses
#954-Fork-1=A (data-emit), reverses #956=A (`serve()` stays WE reference-runtime), violates the
#700/#707 cross-repo boundary (FUI never imports `serve()`), and would diverge from `FORMS` (drift the
exact thing `generateFunctionalSource` was built to avoid). Branch A (consume WE's data-emit) is already
**shipping** — the functional source is in `we:src/_data/authorModeSource.json` today. Both branches
cannot coexist coherently (A's whole point is that FUI does *not* re-emit), and one is broken — but the
broken one is excluded *by a ratified+codified rule*, so this is not an open A/B. It is a **one-line
ratify** of the #954 rule applied to the functional form. Cost ("a real build" for B) is not a branch;
B is excluded on the architecture, not on effort.

### "Decide-point" 3 — adapter input/output contract → mostly FORCED, one micro-fork (Fork 2)

The input/output is almost entirely pinned by the existing tree: **input** = a `<component>` definition
(what `generateFunctionalSource` already parses, via `parseDefinition`), **output** = a JSX module that
imports `@frontierui/jsx-runtime` and self-registers via `defineElement` (what the generator already
emits). The only genuinely-open sub-question is the **transpile boundary** — the served functional form is
JSX and `loader: 'jsx'`, so it MUST be transpiled to be import-able (`serveCompiled`,
`we:blocks/renderers/module-service/moduleService.ts:211`). Who owns that transpile in the served path is
a small but real fork (Fork 2). The rest of point-3 is a **ratify** of the existing contract.

## The forks (recommended defaults)

### Fork 1 — Catalog identity of the authoring functional form

**Recommended: (a) a new first-class authoring form id (`functional` as an *authoring* catalog member,
kept wholly distinct from the consume-mode wrapper catalog).** Concretely: the authoring functional form
is the WE `ServeForm` `functional` that already exists in
`we:blocks/renderers/module-service/moduleService.ts:33/56` — it keeps its id in the **authoring** catalog
(the `FORMS` set `serve()` emits + the committed author-mode data). The
#974/#977 `RETIRED_FORM_ALIASES['functional'] = 'react-wrapper'` retirement stays untouched, because it
governs a **different catalog** — `fui:tools/gen-wrapper/wrapperFormCatalog.mjs` is the *consume-mode
wrapper* catalog (`genWrapper`, wrap-a-WC-for-a-framework), whereas the authoring functional form *lowers
a `<component>` to a standard WC*. Two catalogs, two artifact kinds, two id-spaces. No id collision: the
authoring form is served from the WE-emitted author-mode data (the #954 channel), the consume wrapper from
the FUI genWrapper endpoint.

- *(b) Un-retire `functional` as an authoring member, re-opening #977.* **Rejected** — the retirement is
  consume-mode-only and correct *there* (the genWrapper React wrapper is the right answer for "wrap this
  WC for React"). Un-retiring would force the one `functional` wire id to mean two different things across
  two catalogs (authoring lowering vs React consume-wrapper), reintroducing exactly the ambiguity #977
  removed. No prior-art system aliases an authoring form onto a consume wrapper.
- *(c) A separate, explicitly-named authoring catalog distinct from `WRAPPER_FORMS`.* **Supported by
  default, not a rival branch** — it *describes the same end-state as (a)*: the authoring forms already
  live in a separate id-space (WE's `FORMS` / author-mode data), distinct from FUI's `WRAPPER_FORMS`.
  (a) and (c) are the same architecture stated at two altitudes; (a) is the precise statement.

**Confidence: med-high.** Prior art is unanimous (authoring ≠ consume-wrapper identity); the only
residual is naming ergonomics (whether to brand the authoring id `functional` vs `functional-authoring`
to pre-empt human confusion across the two catalogs) — a cosmetic call, not an architectural one.

**Skeptic:** *"Two forms both called `functional` (WE authoring `ServeForm` + the retired FUI wrapper
alias) is a footgun — a caller will request the wrong one."* SURVIVES — the two ids live in **disjoint
catalogs reached by different endpoints** (author-mode data channel vs the genWrapper wrapper-serve
endpoint), and the wrapper catalog already serves the retired alias as a *deprecation note*, not a 400. A
caller of the authoring channel never sees `WRAPPER_FORMS`. If the naming collision still worries the
ratifier, the cosmetic mitigation is branding the authoring id `functional-authoring`; that does not move
the architecture. Beat: the collision is nominal, not structural.

### Fork 2 — Who transpiles the served JSX functional form

The served functional module is JSX (`loader: 'jsx'`) and is *non-import-able until transpiled*
(`we:blocks/renderers/module-service/moduleService.ts:211` — *"A `jsx`-loader form (functional) MUST be
transpiled to be an ES module"*). `serveCompiled` (`:200`) lowers it through the **injected
`compilerRegistry`** (`:215`), and *"the delivery layer does"* the registration (`:218`). So the fork is:
in the FUI MaaS served path, does FUI (a) inject its own compiler into the registry seam WE already
exposes, or (b) consume a **pre-transpiled** functional artifact committed as data alongside the JSX
source?

- **Recommended: (a) FUI injects a compiler at the served endpoint via the existing `compilerRegistry`
  seam.** This is a *runtime-DI seam the running standard already consults* (`serveCompiled` reads
  `compilerRegistry.get()` at serve time), not a WE-side build. FUI's MaaS endpoint owns transpile of the
  *served* artifact exactly as it owns `genWrapper` transpile today (#974 invariant 5: the FUI endpoint is
  its own runtime; it already transpiles in the wrapper-serve path). The author-mode **panel** still reads
  the WE-emitted *JSX-source* data (display), but the *served, mountable* artifact is transpiled at the
  FUI endpoint — the natural split (data-emit = source for display; endpoint = compiled module for
  execution).
- *(b) Commit a pre-transpiled functional artifact as data.* **Rejected** — transpile target is a serve
  parameter (`transpileTarget`, `we:blocks/renderers/module-service/moduleService.ts:160`), so committing
  one transpiled output fixes a dimension that must stay request-time-variable; and it duplicates the JS
  the FUI endpoint already produces in the wrapper path. The author-mode *source* data stays JSX (the
  display SoT); only the served module is compiled, at the endpoint.

**Confidence: med-high.** The `compilerRegistry` is an established runtime-DI seam (`serveCompiled`
consults it live); aligning the functional served path to the same FUI-endpoint-owns-transpile rule as
the wrapper path is the consistent answer.

**Skeptic:** *"This makes the FUI endpoint depend on a compiler — heavier than just shipping data."*
SURVIVES — the FUI MaaS endpoint **already** transpiles (the genWrapper `-live` forms bundle a renderer +
ErrorBoundary and are transpiled today). Adding the JSX functional form rides the same already-present
transpile capability; it introduces no new dependency class. Beat: the compiler is already there.

## Ratify statements (forced invariants — not forks)

- **Emit placement (#954 rule).** The functional authoring source is a **deterministic WE output**, so it
  rides the **data-emit** channel: WE's `serve()` emits it at build time into
  `we:src/_data/authorModeSource.json`; FUI's workbench/panel reads that data; FUI never imports
  `serve()`. #1602 is therefore *"wire a WE artifact + own the served-module transpile,"* **not** *"build
  a FUI functional emitter."* (Ratify the #954 codified rule as applied to `functional`.)
- **v1 input/output contract.** Input = a `<component>` definition (parsed by `parseDefinition`); output =
  the JSX module `generateFunctionalSource` already emits — `export function <Name>()` returning the
  template JSX, a `class <Name>Element extends HTMLElement` mount wrapper, a `defineElement(...)`
  self-registration, importing `@frontierui/jsx-runtime`. v1 = render only (no callbacks/effects/change
  detection — those are the plan's later phases; change-detection is its own deep-research subject,
  candidate `customChangeDetectorRegistry`). (Ratify the existing contract.)

## What #1602 becomes after this ruling

1. Register/expose the authoring `functional` form as a first-class **authoring** catalog member (distinct
   from `WRAPPER_FORMS`) — Fork 1(a).
2. Wire the FUI workbench/panel to read the WE-emitted functional source from the author-mode data channel
   (display) — emit-placement ratify.
3. Serve the mountable functional module by transpiling the WE-emitted JSX at the FUI endpoint via the
   `compilerRegistry` seam — Fork 2(a).
4. #313 then registers it as the MaaS `?form=…` served entry.

## Why no decision on change detection here

The plan's later phases (callbacks, effects, change detection, a `customChangeDetectorRegistry`) are out
of scope for #1602/v1 and warrant their own deep-research decision — flagged in
`we:plans/functional-component-adapter.md` as *"a whole subject in itself."* This prep deliberately does
not pre-rule it.

## Sources

- [Stencil — Functional Components](https://stenciljs.com/docs/functional-components)
- [Stencil — Custom Elements output target](https://stenciljs.com/docs/custom-elements)
- [Mitosis — Builder.io](https://mitosis.builder.io/)
- [Mitosis — compile JSX to web components (issue #34)](https://github.com/BuilderIO/mitosis/issues/34)
