---
kind: task
parent: "125"
status: resolved
dateOpened: "2026-06-09"
dateStarted: "2026-06-10"
dateResolved: "2026-06-10"
blockedBy: ["234"]
tags: [component, adapters, compiler, build-tooling, webpack, conformance, testing]
relatedReport: reports/2026-06-06-adapter-real-project-integration.md
relatedProject: webadapters
crossRef: { url: /adapters/jsx-adapter/, label: JSX Adapter }
---

# Add a *real* webpack-build conformance test for the `<component>` loader

#234 shipped the baseline webpack loader (`componentWebpackLoader` in
`fui:frontierui/compiler/src/component-transform/plugins.ts`) and proves it via a **mock loader context**
(`{ resourcePath, getOptions }`) in `fui:__tests__/component-transform/plugins.test.ts`. That exercises the
loader contract — id keying, options, lowered return, pass-through on no-match — but unlike the Rollup
and esbuild cases (which run a *real* `rollup.rollup` / `esbuild.build`), it does **not** run a genuine
webpack pass.

The asymmetry is deliberate: webpack + its ecosystem is a heavy devDependency for a ~6-line loader, and
the loader's only webpack-specific surface (the loader-chain integration) is webpack's concern, not the
pre-transform's. This item closes the gap when it's worth the dep.

## Acceptance

- A real `webpack(...)` (or `memfs`-backed) build runs the loader and asserts the same lowered-component
  `MARKERS` the Rollup/esbuild real-build tests assert — mirroring the dual-bundler conformance.
- Adds `webpack` as a devDependency of `@frontierui/compiler` (and a `webpack-loader` subpath export so
  the loader resolves by path — overlaps with package extraction, WE #125).
- No change to the loader body or the `compile()` core — test + packaging only.

Depends on #234 (the loader) and overlaps #125 (subpath exports). Distinct from #232 (native-depth opt-ins).

## Resolution (2026-06-10)

Added a real webpack-build conformance test in `frontierui/compiler`, mirroring the Rollup/esbuild real
builds:

- **`webpack` devDependency** (`^5.107.2`) added to `@frontierui/compiler`, and a **`./webpack-loader`
  subpath export** backed by a new default-export entry `fui:src/component-transform/webpack-loader.ts`
  (delegates to the existing `componentWebpackLoader` in `fui:plugins.ts` — one loader body, surfaced by
  path for `{ loader: '@frontierui/compiler/webpack-loader' }`).
- **`fui:__tests__/component-transform/plugins.webpack.test.ts`** runs a genuine `webpack(...)` pass over
  the shared `fui:surface-fixtures/user-card.tsx` and asserts the same transform-invariant `MARKERS` as the
  Rollup/esbuild real builds. The loader is resolved by path the way webpack requires: the real
  `fui:webpack-loader.ts` entry is esbuild-bundled once to a temp CJS module (the genuine loader code, no
  re-implementation, no `dist/` dependency). A second case proves pass-through when the `tsx` surface
  isn't configured (raw `html\`…\`` survives, no MARKERS) — confirming the real loader ran.
- **No change** to the loader body (`fui:plugins.ts`) or the `compile()` core — test + packaging only.

Full compiler suite green (80 tests incl. the new 2), `tsc` build green (emits
`dist/component-transform/webpack-loader.{js,we:d.ts}`).
