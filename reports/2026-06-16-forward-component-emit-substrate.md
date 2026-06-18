# Forward component-emit substrate — prior-art survey (decision #811)

**Date:** 2026-06-16
**Grounds:** backlog #811 (decide the forward component-emit substrate + per-framework emitter
architecture), blocking the polyglot adapter panel #753, under Block Explorer epic #746.
**Builds on #810's tree verification** (the forward per-framework component emitters do not exist; no
existing neutral substrate forward-emits to them).

## The question

#753 wants a Block-Explorer panel that **generates this block across React / Vue / Svelte / Angular /
native WC** and **live-tests each**. #810 proved nothing in the tree does this today. #811 must decide
*what backs forward component emit* before that panel builds. The item entered prep with one fork
(A: extend the ingest `ComponentIR` · B: HTML-canonical adapters off `htmlToJsx` · C: a new dedicated
forward IR), default B, and the explicit note: *prior art across the five frameworks isn't surveyed yet.*

This survey runs design-first step 1 (browser standards + the benchmark libraries) over the
*multi-framework component generation* space. It reshapes the fork materially.

## What the survey found

The prior art splits into **two families**, and the item's A/B/C all live in only one of them.

### Family 1 — Transpile to native per-framework *source* (the item's A/B/C)

- **Mitosis (Builder.io)** is the one shipping tool that does exactly this. You author a component in a
  **static JSX subset**; Mitosis parses it to a **JSON IR** (`MitosisComponent`) and runs per-framework
  **serializers** that emit React, Vue (3), Svelte, Angular, Solid, Qwik, Preact, Marko, plus
  `customElement` / `webcomponent` / `lit` / `stencil` / `html` targets. It is the existence proof that
  *neutral IR → N-framework idiomatic source* is real and shipping.
  Two load-bearing details:
  1. Its IR is **purpose-built for emit** — a deliberately static, serializable JSON shape designed for
     forward serialization, **not** a lossy ingest representation. Mitosis did **not** reuse an
     analysis/ingest IR; it built an emit-shaped one. This is direct evidence **for Option C over Option
     A**: the item itself flags that the upgrader `ComponentIR` was scoped for *lossy ingest of a
     tractable subset* (`we:upgraderEngine.ts:38`, "flag, don't fake"), which is the wrong shape to carry
     styling / events / slots / reactivity for faithful forward output.
  2. WC is **just one more target** among ~15, not the centre — confirming a transpiler treats native WC
     as a peer output, not the canonical source.
- Each framework also ships its own **template compiler** (Vue SFC compiler, the Svelte compiler, the
  Angular template compiler). These confirm Option B's con concretely: the *template* half of an
  HTML→framework adapter is tractable, but **binding/event/reactivity idioms** (`v-model`, Svelte `bind:`,
  Angular `[()]`) are real per-framework grammars a flat HTML tree under-specifies — so an HTML-canonical
  adapter (B) would have to re-grow exactly the dialect knowledge Mitosis's IR already encodes.

### Family 2 — Emit one web component + generate thin per-framework *wrappers* (the item never named this)

- **Stencil output targets** (`@stencil/react-output-target`, `…/vue-output-target`,
  `…/angular-output-target`): you author **once as a web component**; Stencil **auto-generates framework
  wrapper components** that smooth over interop (properties vs attributes, custom events, types). There is
  **one runtime** — the WC — and per-framework artifacts are wrappers, not reimplementations.
- **Lit Labs** `@lit-labs/gen-wrapper-react` / `-vue` / `-angular`, driven by
  `@lit-labs/gen-manifest`: generate framework wrappers **from the Custom Elements Manifest (CEM)**. The
  generator reads the component's CEM and emits idiomatic wrapper modules per framework.

Both leaders converged on the same answer: **the web component is the single source of truth; the
per-framework artifact is a generated wrapper keyed off the component's CEM.**

### The platform shift that bears directly on the panel's goal

- **React 19 scores 100% on [Custom Elements Everywhere](https://custom-elements-everywhere.com)** — full
  custom-element support (props flow to properties, custom DOM events work with no `ref` plumbing). Vue,
  Svelte and Angular have long scored ~100%. So **as of 2026 a native web component drops cleanly into all
  five frameworks with no per-framework artifact at all** for the common usage case. React was the lone
  historical laggard (the 2017 props-vs-attributes issue); React 19 closed it.

This matters because **the block already IS a web component** (#810: "native WC ≈ the block itself"). The
conformance claim #753's panel actually wants to *demonstrate* — "this WE/FUI block works in each
framework" — is, post-React-19, **true for plain WC consumption**, and the value-add of any generated
artifact is either (a) ergonomic wrappers (Stencil / Lit Labs) or (b) full idiomatic native source
(Mitosis).

## How this reshapes the fork

Research adds a **prior axis the item missed** and narrows the original A/B/C:

1. **A new top-level fork — the emit *model*: WC-core + generated wrappers vs full native-source
   transpilation.** This is the genuine, mutually-exclusive call. If wrappers, the entire neutral
   *component* IR question (A/B/C) **dissolves** — you need the block's CEM (an already-ratified WE
   protocol) + a wrapper generator + a live demo, no component IR at all.
2. **A/B/C survive only *inside* the transpile branch**, and the survey narrows them: B (HTML-canonical)
   must re-grow per-framework binding dialects and the existing `htmlToJsx` is React/JSX-only and
   tree-level (not a component module); A overloads a lossy *ingest* IR; **C (a dedicated emit-purpose IR)
   is what Mitosis validates.** So *within* transpile, the default flips from the item's B to **C**.

## Classification (per-fork 7-question pass)

- **Layer.** The block impl is FUI's; the *forward-generation adapter* is a WE standards artifact — the
  same forward/generation-adapter family as the polyglot MaaS line (#463/#505/#507 ruling: WE owns the
  neutral-contract SoT + deterministic generation adapters + the deterministic conformance gate). The
  **rendered live-test** is FUI's, not WE's: per the docs-rendering boundary, WE never renders FUI block
  code — the panel's "live-test each framework" must be **FUI-hosted demo iframes** (the #701 `fuiDemo`
  embed), with WE generating the code artifact. So: *substrate/generation = WE; live render = FUI demo;
  conformance badge = the #506 deterministic gate.*
- **Protocol or intent?** No UX vocabulary → not an intent. **Option W reuses the already-ratified
  `custom-elements-manifest` protocol** (we:protocols.json:251, ratified #626 Fork 1, *derived* from
  fui:blocks.json via `we:scripts/gen-cem.mjs`, describing tag/attributes/properties/events/slots/CSS-parts) —
  it mints nothing new. Option T (transpile) would own a forward component IR contract (the #463 neutral
  SoT pattern, a new emit-purpose rep).
- **Fixed mechanic vs dimension?** Fixed architecture mechanic, not a per-author dimension.
- **DI-injectable?** The per-framework emitters/wrapper-generators are **devtools providers** behind an
  explicit-input seam — exactly the existing `CustomAnalyzerRegistry` shape (`we:upgraderEngine.ts:97`,
  caller-owned, no global singleton), consulted at author/build time. Not a runtime DI registry.
- **Most-permissive default / seam between intents?** N/A for a build substrate.
- **Separation bias.** Keep the three concerns decoupled: emit substrate (WE), live render (FUI demo),
  conformance badge (#506). All three branches need the badge wiring regardless.

## Recommendation handed to #811

- **Fork 1 (emit model): default W — WC-core + CEM-driven generated wrappers.** The block is already a
  WC; all five frameworks consume WCs cleanly (React 19 = 100% CEE); the wrapper generators are shipping
  prior art (Stencil, Lit Labs) keyed off the **CEM WE already ratified and derives** (#626/`we:gen-cem.mjs`);
  it sidesteps the whole neutral-component-IR question and is far the smallest build. Full native-source
  transpilation (T, the Mitosis path) is the maximalist "idiomatic source per framework" option — file as
  a later enhancement if the panel's pedagogy demands idiomatic source rather than proof-of-consumption.
- **Fork 2 (substrate, *only if* Fork 1 = T): default C — a dedicated forward/emit-purpose IR**, per
  Mitosis's evidence (it built an emit-shaped IR rather than reuse a lossy ingest rep; the upgrader
  `ComponentIR` is explicitly ingest-subset-scoped). A (overload `ComponentIR`) and B (HTML-canonical
  adapters) are the weaker-reuse / partial alternatives. If Fork 1 = W, this fork does not bite.

## Sources

- [Mitosis — Builder.io (overview + targets)](https://mitosis.builder.io/docs/overview/) ·
  [BuilderIO/mitosis (GitHub)](https://github.com/BuilderIO/mitosis) ·
  [Intro to Mitosis: the universal reactive transformer (InfoWorld)](https://www.infoworld.com/article/2337352/intro-to-mitosis-the-universal-reactive-transformer.html)
- [Stencil output targets (GitHub)](https://github.com/stenciljs/output-targets) ·
  [Stencil Vue integration docs](https://stenciljs.com/docs/vue)
- [@lit-labs/gen-wrapper-react (npm)](https://www.npmjs.com/package/@lit-labs/gen-wrapper-react) ·
  [@lit-labs/gen-wrapper-vue (npm)](https://www.npmjs.com/package/@lit-labs/gen-wrapper-vue) ·
  [@lit-labs/gen-manifest (npm)](https://www.npmjs.com/package/@lit-labs/gen-manifest)
- [React 19 full custom-element support](https://aleks-elkin.github.io/posts/2024-12-06-react-19/) ·
  [Custom Elements Everywhere](https://custom-elements-everywhere.com)
</content>
