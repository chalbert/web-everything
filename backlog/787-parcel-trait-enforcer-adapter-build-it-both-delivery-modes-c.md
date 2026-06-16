---
type: issue
workItem: story
size: 3
parent: "715"
status: open
dateOpened: "2026-06-16"
tags: [trait-enforcer, tree-shaking, bundler-adapter, parcel]
---

# Parcel trait Enforcer adapter — build it (both delivery modes, complete the 5-bundler conformance matrix)

Build the fifth trait-enforcer bundler adapter, graduating ratified decision #756. Ship `traitEnforcerParcel(options?)` in tools/trait-enforcer/parcel-plugin.ts mirroring the four siblings, emitting the shared buildTraitManifestSource core via a Parcel Resolver returning { filePath, code }. Support BOTH config-delivery modes from one factory: B — Map as JS arg (options.traitMap, local wrapper referenced by relative path, Parcel >=2.9.0, the documented default); A — declarative via loadConfig reading .trait-enforcerrc / packageKey 'traitEnforcer' when no options. Add dev-deps @parcel/core + @parcel/config-default + @parcel/plugin. DoD: both Parcel rows in the #722 cross-bundler-conformance suite (Part A manifest byte-identity, Part B chunk isolation) completing the five-bundler matrix, plus a real-build chunk-isolation test mirroring the webpack case in multi-bundler.test.ts. Test references the resolver by relative path so needs no published package.

## What to build

- **`tools/trait-enforcer/parcel-plugin.ts`** — `export function traitEnforcerParcel(options?: TraitEnforcerOptions)`
  returning a Parcel `Resolver` (`@parcel/plugin`). Its `resolve()` matches the virtual manifest specifier and
  returns `{ filePath, code: buildTraitManifestSource(opts) }` (byte-identical core to the four siblings —
  [vite-plugin.ts:274](../tools/trait-enforcer/vite-plugin.ts#L274)); returns `null` for non-matching specifiers.
- **Both delivery modes from the one factory** (per the #756 ruling):
  - **B (default):** `options.traitMap` present → use it; declare `invalidateOnStartup` (Map is build-time static).
  - **A:** no `options.traitMap` → read via `config.getConfig(['.trait-enforcerrc', …], { packageKey: 'traitEnforcer' })`
    inside `loadConfig`. Published default export = `traitEnforcerParcel()` (no options).
- **Dev-deps:** `@parcel/core` + `@parcel/config-default` + `@parcel/plugin` (none installed today).

## DoD

- Both Parcel rows in [`cross-bundler-conformance.test.ts`](../tools/trait-enforcer/__tests__/cross-bundler-conformance.test.ts)
  — Part A manifest byte-identity (after line 116) and Part B chunk isolation (after line 250), reusing the shared
  `fixture` (lines 54-63) and `assertIsolation` (lines 134-144) — completing the five-bundler matrix.
- A real-build chunk-isolation test mirroring the webpack case in
  [`multi-bundler.test.ts:101-146`](../tools/trait-enforcer/__tests__/multi-bundler.test.ts#L101). References the
  resolver by **relative path** (Parcel ≥ v2.9.0), so no published package is needed.
- At least one assertion exercising the **A** (`loadConfig`) path, so support-both is covered (not just B).

## Relationship

Child of the trait-tree-shaking epic [#715](/backlog/715/); graduates ratified decision [#756](/backlog/756/)
(support both delivery modes, default to the factory); follows the webpack adapter [#744](/backlog/744/) and
completes the cross-bundler conformance suite [#722](/backlog/722/).
