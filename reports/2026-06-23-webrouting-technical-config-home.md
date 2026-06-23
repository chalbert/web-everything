# webrouting Technical-Config Home — WE Config Schema vs a plateau Configurator Domain

**Point:** The "schema vs Configurator" fork in [we:backlog/1687](../backlog/1687-webrouting-technical-config-home-schema-in-webrouting-vs-a-p.md) is not a real either/or — the standing test (bias-toward-separation + config-extends-platform-default + intent-UX-only) collapses it to support-both: WE owns the route-config **schema** (the contract source-of-truth) and a plateau Configurator **domain** is optional downstream tooling over it (gated by the #499 converse-guard). The one genuine residual fork is *which knobs* the unified schema actually adds, since the `router` block already owns most of the route-config vocabulary as scattered attributes.

---

## Prep for decision #1687 (under the webrouting scaffold epic #1684)

This is the `/prepare` half — research + author the fork to Definition of Ready, no ruling.

## What the Navigation Intent punts, and why it can't take it back

The Navigation Intent (`we:src/_data/intents/navigation.json`) owns the UX axes `structure / history / scroll / transition / guard / persistence`. Its `history` is the UX *contribution* (push / replace / none — "what Back does"), **not** the technical *history mode* (browser / hash / memory — "how the URL is encoded"). Per `we:docs/agent/platform-decisions.md#intents-ux-only` an intent carries no implementation refs, so the technical knobs — base path, history mode, lazy/code-split, prerender, scroll-restoration policy, 404 fallback — need a non-intent home.

## The standing test collapses (a)-vs-(b)

Under `#constellation-placement` (code that *defines a contract* → WE; a *developer-operated tool against your own build* → plateau, the `#devtools-placement` consumer test), `#config-extends-platform-default`, and bias-toward-separation, "schema vs Configurator" is two composable homes, not an either/or. The **schema is the contract SoT in WE**; a **Configurator domain is downstream tooling** over it. That is option (c) with WE-as-SoT, and it is support-both. So the prepared shape leads with the ratify and quarantines a single genuine residual fork (which knobs are net-new).

## WE already owns the vocabulary (scattered)

The `router` block (`we:src/_data/blocks/router.json`) already declares technical-config knobs as `<we-route-view>` / child-`<template>` attributes + properties: `base`, `scroll`, `transition`, `keep-alive`, `lazy`. WE is not greenfield — it owns the vocabulary, just scattered per-element, not unified into a named schema. The **net-new** declarable knobs a config schema adds are **history mode** (browser/hash/memory), **prerender**, **404 fallback**.

## Knob → prior-art (config-vs-code)

| Knob | Next.js | SvelteKit | Vue Router | TanStack | React Router |
|---|---|---|---|---|---|
| base path | **config** `basePath` | **config** `kit.paths.base` | code `createWebHistory(base)` | **config** `basepath` | code `basename` |
| history mode | always browser | always browser | code `createWeb/Hash/MemoryHistory` | code `createBrowser/Hash/MemoryHistory` | code history type |
| lazy/code-split | per-route file | per-route file | code `() => import()` | code `lazy`/file | code `lazy` |
| prerender | **config** static export | **config** `prerender`/`entries` | — | — | — |
| scroll | always | built-in | code `scrollBehavior` fn | **config** `scrollRestoration` | component `<ScrollRestoration>` |
| 404 fallback | file `not-found` | **config** adapter `fallback` | catch-all route | catch-all route | catch-all route |
| trailing slash | **config** `trailingSlash` | **config** `trailingSlash` | — | — | — |

**Highlight:** base path, prerender, trailing-slash and 404 fallback are *declared config* in the file-system frameworks (deploy-shaped, serializable, read without a running app); history mode, scroll and lazy lean *code* (constructor args, render fns, per-route imports). This validates a route-config **schema** as the WE home for the serializable deploy-shaped knobs.

## The plateau Configurator precedent + its converse-guard

`plateau:src/technical-configurator/` already runs the "WE schema + downstream domain" pattern: `plateau:src/technical-configurator/seed-render-strategy.ts` (over WE's #079 Render Strategy Protocol) and `plateau:src/technical-configurator/seed-file-upload.ts` walk a dev through *outcomes* and emit the strategy. A new domain = one `seed-<id>.ts` + one line in `plateau:src/technical-configurator/provider.ts`. But the intents-UX-only **converse-guard** (#499) bounds it: a domain that merely re-homes the schema's enum values is redundant cross-layer duplication (the #499 dissolution). So the routing Configurator domain is a support-both, build-when-it-earns-its-keep concern (one card per documented technical setting), justified only if it adds outcome-framing value over the schema.

## Recommended default

**(c) WE owns the route-config schema as the SoT; a plateau Configurator domain is optional downstream tooling.** Confidence med-high (~75%). The schema follows `#config-extends-platform-default`: per-dimension storage (one key per knob in `webeverything.config.*`), default-less core, native-first/most-permissive defaults. Residual fork: which knobs the schema adds — recommended = the net-new serializable ones (history mode, prerender, 404 fallback) plus unifying the scattered block attributes (base, scroll, lazy) into the named vocabulary.

## Skeptic

SURVIVES. Attack 1 (Configurator-as-SoT): rejected — a data-driven decision tool is a plateau devtool by the consumer test, can't be the contract every router reads; the schema is the only thing a non-DOM consumer can read. Attack 2 (schema-only, no domain ever): survives as the *default position* — the domain is genuinely optional and gated by #499, so "no domain unless it earns its keep" is exactly the recommendation, not a refutation. Attack 3 (the residual "which knobs" fork is a false fork — just adopt all): partially lands — corrected the recommendation to *unify the already-owned attributes + add only the serializable net-new knobs*, excluding the code-shaped ones (scroll fn, lazy import) that the block/markup already homes. No principle violated.
