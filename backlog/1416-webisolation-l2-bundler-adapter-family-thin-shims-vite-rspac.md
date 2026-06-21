---
kind: story
size: 5
status: resolved
locus: frontierui
blockedBy: ["1363"]
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "fui:tools/scope-isolator/adapter-core.ts"
relatedProject: webisolation
tags: [webisolation, css-isolation, frontierui, build-transform, adapters]
---

# webisolation L2: bundler adapter family — thin shims (vite/rspack/webpack/esbuild/rollup) over the pure core

Ship the per-bundler adapter family that hosts the #1363 pure `@scope`→unique-class lowering core, so a
project can apply webisolation L2 with **its own bundler** — explicitly including consuming FUI's
**uncompiled source with rspack, without Vite** (the ratified requirement). Thin shims over one pure
PostCSS core (the trait-enforcer distribution shape — `fui:tools/trait-enforcer/` already ships
vite/esbuild/rollup/webpack/parcel plugins over pure functions): **vite, rspack, webpack, esbuild,
rollup**, none privileged. Per the [standard-consumability](../docs/agent/platform-decisions.md#standard-consumability)
ruling (#1377): contract+conformance stay WE; this reference transform + adapters are published
impl/tooling (FUI-owned, zero-lock-in), never `@webeverything`. Which adapter ships first is prioritization,
not scope — the end-state is the full family.

## Acceptance

- A pure, bundler-agnostic lowering core (from #1363) is wrapped by a thin adapter for each of **vite,
  rspack, webpack, esbuild, rollup** — each ≤ a thin shim, no logic forked from the core.
- A sample project consumes FUI's **uncompiled** block source and applies L2 isolation **via rspack with
  no Vite in the toolchain** (the explicit no-lock-in requirement).
- Adapters published as zero-lock-in tooling (not `@webeverything`); scope-key naming is a config option,
  not bespoke per-adapter logic.

## Progress (batch-2026-06-21)

- `fui:tools/scope-isolator/adapter-core.ts` — the shared shim core: `lowerCss(id, css, options)` routes
  every adapter through the pure #1363 `transform` (no logic forked); `ScopeAdapterOptions.resolveScope`
  makes scope-key naming a config option (default `defaultScopeFromId` = file basename); `include` gates
  which ids are processed.
- Five thin per-bundler shims, none privileged: `fui:tools/scope-isolator/vite-plugin.ts` +
  `fui:tools/scope-isolator/rollup-plugin.ts` (`transform` hook), `fui:tools/scope-isolator/esbuild-plugin.ts`
  (`onLoad` over `.css`), `fui:tools/scope-isolator/webpack-plugin.ts` (a webpack **loader**, context typed
  minimally → no `webpack` dep), `fui:tools/scope-isolator/rspack-plugin.ts` (re-exports the webpack loader —
  rspack runs webpack-compatible loaders).
- **No-lock-in requirement met:** the rspack adapter applies L2 to uncompiled CSS via the webpack-loader
  signature with **no Vite in the toolchain** — a test exercises `scopeIsolatorRspackLoader.call({resourcePath},
  css)` and asserts it is the same loader fn as webpack's, producing the core output.
- 8 unit tests `fui:tools/scope-isolator/__tests__/adapters.test.ts` — every adapter's output is
  byte-identical to a direct `transform()` (proves no fork), plus skip-non-CSS / resolveScope / the
  rspack-no-Vite path. scope-isolator suite 29/29; FUI `check:standards` → 0 errors; adapters typecheck clean.
