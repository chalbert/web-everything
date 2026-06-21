---
kind: story
size: 5
locus: frontierui
status: resolved
blockedBy: []
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "fui:tools/scope-isolator/index.ts"
tags: []
---

# webisolation L2: build-transform impl (unique-class light DOM, transform-primary)

The default/transform-primary conformant impl of the #1362 webisolation contract: a zero-runtime transform that keys a component's CSS to a machine-generated unique scope class — native a11y free, SSR-trivial, total inter-view isolation. Strategy S1 by default; not immune to external hostile CSS (that is S2/shadow, the Configurator opt-in). Conforms to the Layer-1 contract ratified in #1349. **Per the #1377 seam ruling this item is the _pure, bundler-agnostic PostCSS core_** (consumes FUI's authored base `@scope {}`; emits unique-class CSS) — the per-bundler adapter family is #1416, serve-time (MaaS) is #1417, the runtime polyfill is #1364; all wrap this one core.

## Resolved by #1377 (2026-06-21) — integration seam settled

The integration-seam fork the pre-flight note below opened is now **ratified** in #1377 (codified at
`we:docs/agent/platform-decisions.md#standard-consumability`):
- **Authoring SoT** = the standard form — FUI authors **base `@scope {}`** (out-scoping only, which matches
  L2/S1 exactly), *not* a CSS-Modules/vanilla-extract tooling format.
- **Lowering core** = a **pure, bundler-agnostic PostCSS** transform (`@scope`→unique-class). This item.
- **Hosts** = thin adapters around the core: build-time per-bundler family **#1416** (vite/rspack/webpack/
  esbuild/rollup — rspack/uncompiled-source first-class, no Vite lock-in), serve-time/MaaS **#1417**,
  runtime polyfill **#1364**.

Both blockers (#1362 contract, #1377 seam) are resolved → this is now unblocked and agent-ready. The
pre-flight note below is retained as historical context (its "open fork" is the one #1377 closed).

## Pre-flight note — locus fixed (impl→FUI) + an unresolved integration-seam design question (batch-2026-06-20-1358-1357)

Cascade-freed by #1362 (webisolation now exists as a `concept` standard) and surfaced as batchable, but
the pre-flight stopped the batch here for two reasons:

- **Locus corrected `→ frontierui`.** This is an *impl* (a build transform), and the constellation statute
  is impl→FUI ("WE = contracts only", #855/#817; WE holds the contract + conformance vectors, FUI/tooling
  holds the runtime). It had no `locus` so it defaulted to WE; set `locus: frontierui`. Gate each in
  `../frontierui`.
- **Genuine design question #1349 did NOT settle — the L2 transform has no defined input or build seam.**
  #1349's survey found FUI blocks today have **zero** CSS-isolation runtime and style via "ad-hoc global
  classes + `var(--…)` tokens" (`fui:blocks/button/Button.ts:114`, `fui:blocks/card/Card.ts:89`, `fui:blocks/badge/Badge.ts:78`).
  So before this transform can be written there is an open fork: **(a) what component-CSS authoring format
  does the transform consume** (a co-located `.css`/CSS-in-JS module à la vanilla-extract? a `static styles`
  string? a convention over the existing block class soup?) **and (b) which build-tool seam hosts it**
  (a FUI Vite plugin — cf. the existing `fui:tools/trait-enforcer/vite-plugin.ts` — vs PostCSS vs a
  standalone codegen). #1349 ratified the *contract* + that L2 is transform-primary, not the *integration
  mechanism*. Resolve that (a small `/decision`, or fold it into a focused FUI build session that picks the
  native Vite-plugin default) before building — it is not a clean batch-seam item as written.

## Progress

- Built the pure, bundler-agnostic PostCSS core in fui:tools/scope-isolator/index.ts (mirrors the
  trait-enforcer pure-functions-exported split): `scopeIsolator(opts)` PostCSS plugin + `transform(css,
  opts)` runner + `generateScopeClass`/`scopeSelector`/`hashSeed` helpers. Lowers authored base
  `@scope {}` (the standard form per #1377) to CSS keyed to a deterministic unique scope class
  (`<scope>-<fnv1a-base36>`). `:scope` → the class; bare nested selectors → descendants of the class;
  loose decls → a root rule; rules inside `@media`/`@supports` recursed; `@scope (start)` accepted as
  out-scoping (S1, start ignored). Zero-runtime, SSR-stable (deterministic class), idempotent.
- Scope held to the #1377 seam ruling: this is ONLY the core. Per-bundler adapters (#1416), serve-time
  MaaS (#1417), runtime polyfill (#1364) are downstream wrappers — not built here.
- Declared `postcss ^8.5.6` as an explicit fui devDependency (was transitive-only; no reinstall — already
  in node_modules). Tests: fui:tools/scope-isolator/__tests__/scope-isolator.test.ts (11/11 green).
  FUI gate `npm run check:standards` 0 errors; `tsc --noEmit` clean. Cleared the stale
  `blockedBy: ["1362","1377"]` (both resolved).
