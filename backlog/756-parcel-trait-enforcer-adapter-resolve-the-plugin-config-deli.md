---
type: decision
workItem: story
size: 3
parent: "715"
status: resolved
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: none
codifiedIn: "one-off"
preparedDate: "2026-06-16"
relatedReport: reports/2026-06-16-parcel-trait-enforcer-config-delivery.md
tags: [trait-enforcer, tree-shaking, bundler-adapter, parcel, decision-prep]
---

# Parcel trait Enforcer adapter — support both config-delivery modes (factory JS-arg + declarative loadConfig), default to the factory

**Resolved 2026-06-16 — support both, no mandated pick (graduates to build #787).** The fifth bundler. The
fork below was grounded in a Parcel plugin-model survey published as the
[`parcel-trait-enforcer-config-delivery`](/research/parcel-trait-enforcer-config-delivery/) research topic
(session report `we:reports/2026-06-16-parcel-trait-enforcer-config-delivery.md`). **The survey first reshaped
the fork, then ratification dissolved it:** #744 carved Parcel out believing "Parcel can't follow the
`traitEnforcerX(options)` factory shape, so the Map can't be a JS argument." That premise is **wrong** since
**Parcel v2.9.0**, which lets a plugin be referenced in `.parcelrc` by **relative path** to a local JS file
— so a thin local wrapper *can* pass the Map as a JS arg and preserve the factory symmetry. The deeper
finding at ratification: **A and B are not mutually exclusive and neither is flawed** — one shipped factory
`traitEnforcerParcel(options?)` serves *both* delivery modes — so per WE's fork-existence test (WE mandates
nothing; support every coherent end-state) the call is **support both, default to the factory**, not pick.

See the **Resolution** block for the ratified ruling; the original fork is preserved beneath it as context.

## Resolution (ratified 2026-06-16)

**Ruling — support both delivery modes from one factory; document the factory (B) as the default.** WE ships
`traitEnforcerParcel(options?)` (mirroring the four shipped adapters' `traitEnforcerX(options)` shape), whose
resolver accepts the trait `Map` via *either* path:

- **B — JS-arg via local wrapper (documented default).** `options.traitMap` provided → use it. The project
  authors a tiny local `we:parcel-resolver-trait-enforcer.js` (`export default traitEnforcerParcel({ traitMap })`)
  referenced in `.parcelrc` by **relative path** (Parcel ≥ v2.9.0). Preserves the cross-bundler
  `traitEnforcerX(options)` symmetry; Map composable in JS at build time. Most-flexible → the default (WE's
  most-flexible-default principle). Cache caveat covered by `invalidateOnStartup` (Map is build-time static).
- **A — declarative `loadConfig` (first-class alternative, not rejected).** No `options.traitMap` → the
  resolver reads the Map via `config.getConfig(['.trait-enforcerrc', …], { packageKey: 'traitEnforcer' })`.
  The project points `.parcelrc` straight at the published `@frontierui/parcel-resolver-trait-enforcer`
  (default export = `traitEnforcerParcel()`, no options) and supplies a `.trait-enforcerrc` / `we:package.json`
  `"traitEnforcer"` key. Native-idiomatic + cache-correct for Parcel-purist projects.

**Why support both (not a pick):** both A and B are coherent end-states a real project would legitimately
prefer (Parcel-idiomatic shop → A; cross-bundler-consistency shop → B); neither is flawed, so neither fails
the fork-existence test. **The prepare pass's lock-in objection to A dissolves:** `.trait-enforcerrc` +
`packageKey` is *Parcel's own* plugin-config convention (Sass/Babel/PostCSS precedent), not a WE-invented
format, and it's fully escapable (same Map data either way) — platform-aligned, not a lock.

**Still rejected — C (WE *generating* a project-owned `.parcelrc`/config file).** That is the real
*minimize-lock-in* violation and is inconsistent with all four shipped adapters (the project always wires its
own build config).

**Graduates to build slice [#787](/backlog/787/):** implement `we:tools/trait-enforcer/parcel-plugin.ts` with
both delivery paths, add the dev-deps, complete the five-bundler conformance matrix. Cost of support-both
over a single pick = a guarded `loadConfig` branch (~10–15 lines) + one extra conformance assertion —
modest, and required by the mandate-nothing principle.

---

## Decision context (original fork, retained)

The concern decomposes into one real call plus two forced invariants. The shared core
`buildTraitManifestSource(options)` (`we:tools/trait-enforcer/vite-plugin.ts:274-282`) is reused verbatim
across all four shipped adapters (Vite `we:vite-plugin.ts:289`, Rollup `we:rollup-plugin.ts:21`, esbuild
`we:esbuild-plugin.ts:23`, webpack `we:webpack-plugin.ts:26`); the only Parcel-specific question is **how the
trait `Map` reaches a declarative (named-in-`.parcelrc`) Resolver**, given that `.parcelrc` carries no
inline plugin options. A Parcel `Resolver`'s `resolve()` returns a `ResolveResult` whose `code` field *is*
a virtual module, so the manifest mechanism is settled; v2.9.0 relative-path plugins reopen the JS-factory
path the original framing foreclosed.

## Recommended path at a glance

| Element | Recommended default | Main alternative | Confidence |
| --- | --- | --- | --- |
| **Fork 1 — how the trait Map reaches the resolver** | **B — local wrapper preserving the factory (v2.9.0 relative-path)** | A — idiomatic `.trait-enforcerrc`/packageKey via `loadConfig` | Med-high |

## Supported by default (not decisions — forced invariants)

- **Virtual module via `resolve()` returning `{ filePath, code }`** from `buildTraitManifestSource(options)`
  — the only Parcel-native mechanism, emitting byte-identical core source to the other four adapters; the
  `() => import(spec)` thunks then code-split natively. The Resolver returns `null` for any non-matching
  specifier (Parcel's pipeline pattern). ([Parcel Resolver](https://parceljs.org/plugin-system/resolver/))
- **`.parcelrc` registration is hand-authored + documented**, consistent with all four shipped adapters
  (the project wires every one into its own build config). WE generating a project-owned `.parcelrc` would
  violate *minimize-lock-in / no project-facing generated files*. Only the **specifier** differs by branch
  (a published package name under A; a relative path under B).
- **Dep scope:** a real Parcel build needs the full `@parcel/config-default` stack **+ `@parcel/plugin`**,
  not just `@parcel/core` as #744 assumed. None are installed today (`we:package.json` carries only `webpack`
  explicitly). The conformance test references the resolver by **relative path** (v2.9.0), so it needs no
  published package.

## Fork 1 — how the trait Map reaches the Parcel resolver

**Crux.** Unlike the other four bundlers, a Parcel Resolver is referenced **by name** in `.parcelrc` and
instantiated by Parcel — and `.parcelrc` carries **no inline options** — so the trait `Map` can't simply be
a constructor argument the way `traitEnforcerVite({ traitMap })` is wired into `we:vite.config.ts`. How does
the named resolver obtain the Map?

- **A — idiomatic declarative config.** Publish `@frontierui/parcel-resolver-trait-enforcer`; the project
  adds it to `.parcelrc` `"resolvers"` and supplies the Map in a `.trait-enforcerrc` file or a
  `we:package.json` `"traitEnforcer"` key, read via the resolver's `loadConfig` →
  `config.getConfig(['.trait-enforcerrc', …], { packageKey: 'traitEnforcer' })`. *Tradeoff:* most
  native-Parcel and cache-invalidation-correct (matches the Sass/Babel/PostCSS precedent), **but mints a
  new project-facing config-file format and breaks the cross-bundler JS-factory symmetry** (the Map becomes
  data in a file rather than the JS object every other adapter takes).
- **B — local wrapper preserving the factory (v2.9.0 relative-path). ← recommended.** Ship
  `traitEnforcerParcel(options)` (returns a configured `Resolver`); the project authors a tiny local
  `we:parcel-resolver-trait-enforcer.js` that imports it and passes the Map as a JS arg captured in a closure,
  referenced in `.parcelrc` by **relative path** (allowed since Parcel v2.9.0 — no `we:package.json` needed):

  ```js
  // parcel-resolver-trait-enforcer.js   ("resolvers": ["...", "./parcel-resolver-trait-enforcer.js"])
  import { traitEnforcerParcel } from '@frontierui/trait-enforcer/parcel';
  export default traitEnforcerParcel({ traitMap: { sortable: '…', 'export-csv': '…' } });
  ```

  *Tradeoff:* **preserves the `traitEnforcerX(options)` symmetry across all five adapters, introduces no
  new config format, and matches how the other four are consumed** (the project authors build-config JS).
  Its one caveat — the Map isn't loaded through Parcel's cache-aware `loadConfig` — is covered by an
  `invalidateOnStartup` (or explicit `invalidateOnFileChange` on the wrapper) declaration, since the Map is
  build-time static.

**Ratification outcome (see Resolution above):** the A-vs-B framing was dissolved, not picked. One factory
`traitEnforcerParcel(options?)` serves **both** modes; **B is the documented default** and **A is a
first-class supported alternative** (its lock-in objection dissolved — `.trait-enforcerrc`/`packageKey` is
Parcel's own convention, not a WE format). The config-key/filename sub-decision resolves to A's
`.trait-enforcerrc` (JSON5) + `packageKey: 'traitEnforcer'` (Sass `.sassrc` convention) for the declarative
path; B needs no naming. Only **C** (WE-generated config) stays rejected.

---

## Context

**Sequencing / graduation.** On ratification this graduates to the build slice: implement the Parcel adapter
in `we:tools/trait-enforcer/parcel-plugin.ts` (mirroring the four siblings), add the dev-deps
(`@parcel/core`, `@parcel/config-default`, `@parcel/plugin`), and complete the conformance matrix.

**DoD (the build slice must add).** Both Parcel rows in the #722 cross-bundler conformance suite
(`we:tools/trait-enforcer/__tests__/cross-bundler-conformance.test.ts` — Part A manifest byte-identity after
line 116, Part B chunk isolation after line 250, reusing the shared `fixture` at lines 54-63 and
`assertIsolation` at 134-144), completing the five-bundler matrix; plus a real-build chunk-isolation test
mirroring the webpack case in `we:tools/trait-enforcer/__tests__/multi-bundler.test.ts:101-146`. The test
references the resolver by relative path (v2.9.0), so it needs no published package.

**Relationship.** Child of the trait-tree-shaking epic [#715](/backlog/715/); follows the webpack adapter
[#744](/backlog/744/) (which carved Parcel here) and completes the suite [#722](/backlog/722/).
