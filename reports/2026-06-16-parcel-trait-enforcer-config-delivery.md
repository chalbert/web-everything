# Parcel trait Enforcer adapter — the config-delivery fork (prep research for #756)

**Date:** 2026-06-16 · **For:** decision [#756](/backlog/756-parcel-trait-enforcer-adapter-resolve-the-plugin-config-deli/) (child of trait-tree-shaking epic [#715](/backlog/715/)) · **Status:** prepared (not yet ratified)

## Why this decision exists

The trait Enforcer ships usage-scanned, tree-shaking adapters for four bundlers, all built on **one shared
core** and **one factory shape** — `traitEnforcerX(options)` taking a `TraitEnforcerOptions` with a JS
`traitMap`:

- Vite — `traitEnforcer(options): Plugin` (`we:tools/trait-enforcer/vite-plugin.ts:289`)
- Rollup — `traitEnforcerRollup(options): Plugin` (`we:tools/trait-enforcer/rollup-plugin.ts:21`)
- esbuild — `traitEnforcerEsbuild(options): Plugin` (`we:tools/trait-enforcer/esbuild-plugin.ts:23`)
- webpack — `traitEnforcerWebpack(options)` → `{ apply(compiler) }` (`we:tools/trait-enforcer/webpack-plugin.ts:26`)

Every one calls the shared `buildTraitManifestSource(options): string`
(`we:tools/trait-enforcer/vite-plugin.ts:274-282`), which returns the manifest module **source** (a string of
`() => import(spec)` thunks) and wraps it per the bundler's model: Vite/Rollup return it from `load`; esbuild
returns `{ contents, loader: 'js' }`; webpack rewrites the virtual id to a `data:text/javascript,` URI.

#744 added webpack and **carved Parcel to #756** because Parcel's plugin model is **declarative**: a Resolver is
referenced **by name** in `.parcelrc` and instantiated by Parcel — so (the #744 reasoning went) the trait Map
"can't be a JS factory argument," and the project must hand the Map to a named plugin some other way. #756 is
the fork over *how*.

## What the prior-art survey found

### 1 · Parcel resolvers natively support virtual modules — the mechanism is sound

A Parcel `Resolver`'s `resolve()` returns a `ResolveResult` whose **`code`** field — *"the code of the resolved
asset; if provided, this is used rather than reading the file from disk"* — is exactly a virtual module. So the
Parcel adapter is a Resolver that, for the virtual id, returns `{ filePath: virtualId, code:
buildTraitManifestSource(options) }`, reusing the shared core unchanged (the `() => import()` thunks then code-split
like every other bundler). Resolvers run as a **pipeline** — return `null` to pass to the next resolver — so the
adapter only handles its own virtual id. ([Parcel Resolver docs](https://parceljs.org/plugin-system/resolver/))

### 2 · A named `.parcelrc` plugin gets config via `loadConfig` / `getConfig` — not JS args

`.parcelrc` registers plugins **by name** in arrays (`"resolvers": ["...", "parcel-resolver-x"]`) and **carries no
inline plugin options**. The idiomatic way a named plugin reads project config is the `loadConfig` hook calling
`config.getConfig([files], { packageKey })` — it searches **up the directory tree** for the named files
(JSON5 default, also JS/TOML) and a **`we:package.json` key**, e.g. the Sass transformer's
`getConfig(['.sassrc', 'we:.sassrc.js'], { packageKey: 'sass' })`. Docs stress: *"use Parcel's config loading
mechanism so the cache can be properly invalidated; avoid loading files directly from the file system."* Plugin
naming convention is `parcel-resolver-<tool>` (or scoped `@scope/parcel-resolver-<tool>`).
([Configuration](https://parceljs.org/plugin-system/configuration/) ·
[issue #1978](https://github.com/parcel-bundler/parcel/issues/1978))

### 3 · The load-bearing finding — **Parcel v2.9.0+ allows relative-path plugins**, so the factory shape *can* survive

Since **Parcel v2.9.0**, a plugin can be referenced in `.parcelrc` as a **relative path** to a local JS file —
*"they don't need their own we:package.json; you can reference a JavaScript file directly."*
([v2.9.0 blog](https://parceljs.org/blog/v2-9-0/)) This overturns #744's premise. A project can author a tiny
**local resolver module** that imports a WE factory and passes the Map **as a JS argument**, captured in a closure:

```js
// parcel-resolver-trait-enforcer.js  (project-local, referenced by relative path in .parcelrc)
import { traitEnforcerParcel } from '@frontierui/trait-enforcer/parcel';
export default traitEnforcerParcel({ traitMap: { sortable: '…', 'export-csv': '…' } });
```

where `traitEnforcerParcel(options)` returns `new Resolver({ resolve({ specifier }) { return specifier ===
virtualId ? { filePath: virtualId, code: buildTraitManifestSource(options) } : null } })`. This **preserves the
cross-bundler `traitEnforcerX(options)` symmetry** — all five adapters take `options.traitMap` as a JS arg — with
no new config-file format and no published package. So the genuine fork is **not** "the Map can't be a JS arg" but
*declarative-config (idiomatic Parcel) vs. local-wrapper (preserve the factory)*.

### 4 · Dep scope

A real Parcel build (for the conformance test) needs the **full `@parcel/config-default` stack**, not just
`@parcel/core` as #744 assumed — plus `@parcel/plugin` to author the Resolver. No `@parcel/*` is installed today
(`we:package.json` carries only `webpack` explicitly; rollup/esbuild ride in transitively via Vite).

## The reshaped fork

The single muddled "factory options vs `.parcelrc` + config file" question decomposes into **one real call** plus
invariants that aren't decisions:

- **Forced invariant — virtual module via `resolve()` returning `{ filePath, code }`** from
  `buildTraitManifestSource` (the only Parcel-native mechanism; identical core bytes to the other four).
- **Forced invariant — `.parcelrc` registration is hand-authored + documented**, consistent with all four shipped
  adapters (the project wires every one into its own build config; WE generating a project-owned `.parcelrc` would
  violate *minimize-lock-in / no project-facing generated files*). Only the **specifier** differs by branch.
- **The real call — how the trait Map reaches the resolver:**
  - **A — idiomatic declarative config:** publish `@frontierui/parcel-resolver-trait-enforcer`; project adds it
    to `.parcelrc` and puts the Map in a `.trait-enforcerrc` file / `we:package.json` `"traitEnforcer"` key, read via
    `loadConfig`+`getConfig`. Most native-Parcel, cache-invalidation-correct — **but mints a new project-facing
    config format and breaks the JS-factory symmetry**.
  - **B — local wrapper preserving the factory (recommended):** ship `traitEnforcerParcel(options)`; project
    authors a small local resolver file referenced by **relative path** (v2.9.0+). **Preserves cross-bundler
    symmetry, introduces no new format, consistent with how the other four adapters are consumed** (project writes
    build-config JS), no published package required. Caveat: the Map isn't loaded through Parcel's cache-aware
    `loadConfig` — but it's build-time static, so the resolver declares `invalidateOnStartup` / an explicit
    `invalidateOnFileChange` on the wrapper.
  - **C — WE-generated config (`.trait-enforcerrc`/`.parcelrc`):** *rejected* — WE writing project-owned files
    violates minimize-lock-in and is inconsistent with every other adapter.

**Recommendation: B**, default — it keeps the epic's "one Map, every bundler" symmetry, adds no project-facing
format, and matches the four shipped adapters; A is the principled main alternative (more idiomatic Parcel) where
the genuine judgment lives. Confidence **med-high**.

## DoD (carried into #756)

Both Part A (manifest byte-identity) and Part B (chunk isolation) rows for Parcel in the #722 suite
(`we:tools/trait-enforcer/__tests__/cross-bundler-conformance.test.ts` — fixture at lines 54-63, `assertIsolation`
at 134-144), completing the five-bundler matrix; plus a real-build test mirroring the webpack case in
`we:tools/trait-enforcer/__tests__/multi-bundler.test.ts:101-146`. The test references the resolver by **relative
path** (v2.9.0), so it needs no published package.

## Sources

- [Parcel Resolver plugin](https://parceljs.org/plugin-system/resolver/)
- [Parcel plugin configuration](https://parceljs.org/plugin-system/configuration/)
- [Parcel v2.9.0 — relative-path plugins](https://parceljs.org/blog/v2-9-0/)
- [parcel#1978 — plugin options in we:package.json](https://github.com/parcel-bundler/parcel/issues/1978)
