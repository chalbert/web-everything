---
kind: story
size: 3
parent: "715"
status: resolved
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: tools/trait-enforcer/parcel-plugin.ts
tags: [trait-enforcer, tree-shaking, bundler-adapter, parcel]
---

# Parcel trait Enforcer adapter — build it (both delivery modes, complete the 5-bundler conformance matrix)

Build the fifth trait-enforcer bundler adapter, graduating ratified decision #756. Ship `traitEnforcerParcel(options?)` in we:tools/trait-enforcer/parcel-plugin.ts mirroring the four siblings, emitting the shared buildTraitManifestSource core via a Parcel Resolver returning { filePath, code }. Support BOTH config-delivery modes from one factory: B — Map as JS arg (options.traitMap, local wrapper referenced by relative path, Parcel >=2.9.0, the documented default); A — declarative via loadConfig reading .trait-enforcerrc / packageKey 'traitEnforcer' when no options.

Add dev-deps @parcel/core + @parcel/config-default + @parcel/plugin. DoD: both Parcel rows in the #722 cross-bundler-conformance suite (Part A manifest byte-identity, Part B chunk isolation) completing the five-bundler matrix, plus a real-build chunk-isolation test mirroring the webpack case in we:multi-bundler.test.ts. Test references the resolver by relative path so needs no published package.

## What to build

- **`we:tools/trait-enforcer/parcel-plugin.ts`** — `export function traitEnforcerParcel(options?: TraitEnforcerOptions)`
  returning a Parcel `Resolver` (`@parcel/plugin`). Its `resolve()` matches the virtual manifest specifier and
  returns `{ filePath, code: buildTraitManifestSource(opts) }` (byte-identical core to the four siblings —
  [we:vite-plugin.ts:274](../tools/trait-enforcer/vite-plugin.ts#L274)); returns `null` for non-matching specifiers.
- **Both delivery modes from the one factory** (per the #756 ruling):
  - **B (default):** `options.traitMap` present → use it; declare `invalidateOnStartup` (Map is build-time static).
  - **A:** no `options.traitMap` → read via `config.getConfig(['.trait-enforcerrc', …], { packageKey: 'traitEnforcer' })`
    inside `loadConfig`. Published default export = `traitEnforcerParcel()` (no options).
- **Dev-deps:** `@parcel/core` + `@parcel/config-default` + `@parcel/plugin` (none installed today).

## DoD

- Both Parcel rows in [`we:cross-bundler-conformance.test.ts`](../tools/trait-enforcer/__tests__/cross-bundler-conformance.test.ts)
  — Part A manifest byte-identity (after line 116) and Part B chunk isolation (after line 250), reusing the shared
  `fixture` (lines 54-63) and `assertIsolation` (lines 134-144) — completing the five-bundler matrix.
- A real-build chunk-isolation test mirroring the webpack case in
  [`we:multi-bundler.test.ts:101-146`](../tools/trait-enforcer/__tests__/multi-bundler.test.ts#L101). References the
  resolver by **relative path** (Parcel ≥ v2.9.0), so no published package is needed.
- At least one assertion exercising the **A** (`loadConfig`) path, so support-both is covered (not just B).

## Relationship

Child of the trait-tree-shaking epic [#715](/backlog/715/); graduates ratified decision [#756](/backlog/756/)
(support both delivery modes, default to the factory); follows the webpack adapter [#744](/backlog/744/) and
completes the cross-bundler conformance suite [#722](/backlog/722/).

## Progress (2026-06-16, batch-2026-06-16) — built

- **Adapter:** [we:tools/trait-enforcer/parcel-plugin.ts](../tools/trait-enforcer/parcel-plugin.ts) — `traitEnforcerParcel(options?)` returns a Parcel `Resolver` whose `resolve()` matches the virtual specifier and emits `{ filePath, code: buildTraitManifestSource(config) }` (byte-identical shared core). Default export = the no-options (mode A) resolver, so `.parcelrc` registers it by relative path (Parcel ≥ 2.9.0, no published package).
- **Both #756 delivery modes from one factory:** B (default) — `traitMap` passed as a JS arg, declares `invalidateOnStartup`; A — declarative `loadConfig` via `config.getConfig(['.trait-enforcerrc', …], { packageKey: 'traitEnforcer' })` when no options.
- **Dev-deps:** added `@parcel/core` + `@parcel/config-default` + `@parcel/plugin`.
- **Conformance matrix completed (5 bundlers):** [we:cross-bundler-conformance.test.ts](../tools/trait-enforcer/__tests__/cross-bundler-conformance.test.ts) — **Part A** Parcel manifest byte-identity (invokes the resolver) + **Part B** Parcel **real build** chunk isolation (eager inlined, lazy/preload split, unused = zero bytes) via `assertIsolation`.
- **Real build harness:** [we:parcel-build-harness.ts](../tools/trait-enforcer/__tests__/parcel-build-harness.ts) — esbuild-compiles the plugin to a temp `.mjs`, writes `.parcelrc` referencing it by relative path, runs Parcel in a **child Node process** (Parcel's lmdb cache binding breaks under vitest's module env), reads back the bundles. Two Parcel-specific gotchas handled: a leading `/` specifier is project-root-relative in Parcel (use `./`), and the cache is pinned into the temp dir (+ `.parcel-cache/` gitignored).
- **multi-bundler.test.ts:** Parcel real-build (used/unused split, mirrors the webpack case) + explicit **mode-A `loadConfig`** and mode-B assertions.
- **Verified:** full trait-enforcer suite **60/60** (incl. 2 real Parcel builds), new files typecheck clean, `check:standards` green.
