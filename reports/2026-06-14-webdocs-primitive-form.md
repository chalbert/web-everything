# Web Docs self-host primitive form — prior-art survey + fork grounding (#425)

**Date:** 2026-06-14 · **For:** backlog [#425](../backlog/425-self-host-web-docs-ui-primitives-the-cancel-and-self-host-fl.md)
(FUI slice of the [#398](../backlog/398-build-the-web-docs-product-fui-open-primitives-plateau-app-o.md)
Web Docs product epic, under the [#091](../backlog/091-web-docs-as-a-service-plateau.md) ruling) ·
**Status:** prep artifact (design-first step 1) — the decision is still open.

## Why this exists

#091/#398 settled the **home** (FUI ships the self-host primitives) and the **what** ("enough free,
composable parts to assemble a self-hosted Web Docs UI") but not the **form**. The item's batch
pre-flight note (2026-06-13) framed the open question as "custom-element block vs JSX component vs new
package" and asserted there is "no FUI content precedent" and that "jsx-runtime exists but is unused for
content." Reading the real tree shows that framing is **stale**, and a prior-art survey shows the
question has a named, well-understood answer shape. This report records both so the decision turn is a
ratification.

## Concrete tree findings (the framing was stale)

- **FUI *does* have a content primitive.** `@frontierui/jsx-runtime`
  (`frontierui/packages/jsx-runtime/`) is described in its own `package.json` as "an HTML-mirror-dialect
  JSX factory that builds real DOM." `JSXRenderer.ts` `createElement(type, props, …children)` constructs
  **light-DOM** nodes (no shadow root). It is **used**, not dormant: `blocks/renderers/` re-exports it,
  `demos/declarative-spa-jsx.tsx` exercises it, and the component-compiler has JSX surface fixtures. So
  "JSX is unused for content" is wrong — JSX *is* FUI's content-authoring path.
- **But there is no server/string render anywhere in FUI.** `jsx-runtime` only builds DOM at runtime;
  there is no `renderToString`/SSR entry (`grep` of `packages/jsx-runtime/src` finds only
  `document`/`createElement`). `blocks/view/ViewEngine.ts` is client-only (`document.startViewTransition`).
  This is the actual gap, not the authoring model.
- **The reference impl is a different paradigm.** WE's `/protocols/` + capabilityMatrix render is
  **11ty Nunjucks** server templates (`webeverything/src/protocols.njk`,
  `src/capability-pages.njk`) — server-rendered static HTML, no client runtime. So "generalize WE's
  render into FUI parts" is a paradigm port, not a copy.
- **No consumer pins the form.** plateau-app aliases `@we/*` to webeverything directly and imports no
  `@frontierui/*`, so nothing external dictates the primitive shape.

The tension is therefore **rendering contract**, not "block vs JSX": a docs product's load-bearing
requirement is **static HTML** (host-anywhere, SEO, readable with JS off), and every FUI content path is
**client-runtime DOM**, while WE's reference is **server-static**.

## Prior-art survey (design-first step 1)

**Islands architecture** is the established HTML-first pattern for exactly this shape — a mostly-static
content page with small interactive regions:

- An island is an interactive component on an otherwise static, server-rendered HTML page; only the
  interactive regions ship JS and hydrate independently ([Astro Islands](https://docs.astro.build/en/concepts/islands/),
  [patterns.dev](https://www.patterns.dev/vanilla/islands-architecture/)). HTML-first by default,
  selective per-component hydration, minimal JS payload.
- Docs/content sites are the canonical use case — zero-JS-by-default with islands for the few
  interactive widgets ([Fresh](https://fresh.deno.dev/), zero-JS blog write-ups). Qwik adds
  resumability; Astro/Fresh ship static HTML + island hydration.
- **Declarative Shadow DOM (DSD)** is the *native-platform* mechanism for server-rendering a custom
  element: HTML written as `<template shadowrootmode="open">` attaches a shadow root with **no JS**, and
  hydration becomes optional for non-interactive parts
  ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM),
  [DebugBear](https://www.debugbear.com/blog/declarative-shadow-dom)). Lit-SSR and Stencil both render
  components to DSD on the server, then optionally hydrate ([Lit SSR](https://lit.dev/docs/ssr/client-usage/)).
  DSD hydration is fiddly (server/client reconciler mismatches are a known footgun).

**Mapping back to FUI:** FUI's behavior blocks (`droplist`, `tabs`, `navigation`, `for-each`, `traits`)
are **light-DOM custom elements that enhance markup in place** — i.e. they are *already* islands by
construction (no shadow root, progressive over server HTML). And jsx-runtime is a *light-DOM* HTML-mirror
factory, so the static skeleton needs **no DSD** — plain server-rendered HTML + light-DOM behavior-block
islands is the simplest correct composition. DSD is only relevant if a primitive wants style
encapsulation, which docs chrome does not.

## What this implies for the forks (recommendation)

1. **Rendering contract → static-first islands.** Server-render primitives to static HTML; hydrate only
   interactive islands. Client-runtime SPA is a flawed branch for a self-host *docs* floor.
2. **Authoring form → JSX on `@frontierui/jsx-runtime`, with a new server render-to-string emit.**
   Reuses FUI's existing HTML-mirror content primitive (no second paradigm, no Nunjucks/engine lock-in),
   light-DOM (no DSD complexity). The only real build is the string-emit path — a separable FUI-core
   capability, carve as a prerequisite item.
3. **Interactivity → compose the existing behavior blocks as light-DOM islands**, hydrate-optional —
   reuse, not reinvent; degrades to static HTML with JS off.
4. **Packaging → single published `@frontierui/webdocs-ui`** (impl publishes `@frontierui`) depending on
   jsx-runtime (+ its SSR entry) and the behavior blocks it composes.

The one place genuine judgment remains is **hydrate-optional vs pure-static** for the interactive panels
(tabbed/filterable conformance matrix vs plain `<details>`/anchors) — defaulted to hydrate-optional
(static-first always; hydration is the self-hoster's opt-in), confidence medium.
