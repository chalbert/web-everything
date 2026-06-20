---
kind: task
parent: "125"
status: resolved
dateOpened: "2026-06-09"
blockedBy: ["231"]
dateStarted: "2026-06-09"
dateResolved: "2026-06-09"
tags: [component, adapters, compiler, build-tooling, rollup, webpack, babel, plugin-wrappers]
relatedReport: reports/2026-06-06-adapter-real-project-integration.md
relatedProject: webadapters
crossRef: { url: /adapters/jsx-adapter/, label: JSX Adapter }
---

# Ship the baseline Rollup / webpack / Babel pre-transform wrappers for the `<component>` compiler

#231 shipped the toolchain-depth axis baseline for the **top 2** bundlers — `componentVitePlugin`
and `componentEsbuildPlugin` (`fui:frontierui/compiler/src/component-transform/plugins.ts`), both thin
wrappers over the shared `compile()` core. The remaining baseline targets named in #127's "re-wraps
cleanly across Vite/esbuild/Rollup/webpack/Babel" are not yet shipped:

- **Rollup** — the Vite plugin's `transform`/`enforce` shape is already Rollup-compatible, so this is
  likely a re-export + a conformance test (confirm it runs under a real `rollup.rollup`), not new code.
- **webpack** — a loader (`module.exports = function(source){ return compile(source, this.resourcePath, opts).code }`).
- **Babel** — a plugin that runs the pre-transform (or documents that Babel users run it as a separate
  pre-step, since Babel operates on JS AST not file text).

Each is "the same few lines over `compile()`" (per the #231 module doc, `fui:STRATEGY-AXES.md`). This is
*baseline* coverage, distinct from **#232**'s per-bundler-*native* depth (the Rust/WASM SWC plugin).

## Acceptance

- A `<component>` lowers identically under Rollup and webpack (mirror the dual-bundler conformance in
  `fui:plugins.test.ts`).
- Babel: either a working plugin or a documented "run the pre-transform first" path.
- No change to the `compile()` core or the surface axis — wrappers only.

Depends on #231 (the `compile()` core + axes). Distinct from #232 (native-depth opt-ins).

## Progress

- **Status:** resolved (2026-06-09)
- **Branch:** docs/standard-authoring-workflow
- **Done:**
  - **Rollup** — `componentRollupPlugin` (`fui:frontierui/compiler/src/component-transform/plugins.ts`), the
    same `transform` hook as Vite (extracted to a shared `transformHook`) minus Vite's `enforce`.
    Conformance: byte-identical shared-hook output **and** a *real* `rollup.rollup` build asserting the
    lowered-component markers.
  - **webpack** — `componentWebpackLoader`, a `function(source)` over `compile()` keyed on
    `this.resourcePath` / `this.getOptions()`, pass-through on no-match, throws on compile error. Verified
    via a mock loader context (no `webpack` devDep added for a 6-line baseline wrapper).
  - **Babel** — documented pre-step path in `fui:STRATEGY-AXES.md` ("Babel — a documented pre-step, not a
    wrapper"): Babel works on a JS AST not file text, so a plugin would duplicate `compile()` and break
    "wrappers only"; Babel users run the pre-transform ahead of Babel via any wrapper / direct `compile()`.
  - Exports wired through `we:index.ts`; `fui:STRATEGY-AXES.md` Axis-2 section updated; `rollup` added to the
    compiler's devDependencies.
  - Tests: full compiler suite green (78/78; plugin file 4→8). Repo `check:standards` green.
- **Acceptance:** met. Lowers identically under Vite/Rollup/webpack/esbuild (cross-bundler marker test
  broadened to all four); Babel documented path; `compile()` core + surface axis untouched (wrappers only).
- **Leftover → #238:** the webpack case uses a mock loader context, not a *real* `webpack(...)` build
  (Rollup/esbuild do run real builds) — adding a genuine webpack-build test (needs the `webpack` devDep +
  a `webpack-loader` subpath export, overlaps #125) is captured as **#238**.
