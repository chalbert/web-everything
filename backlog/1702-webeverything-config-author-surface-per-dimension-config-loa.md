---
kind: story
size: 8
status: resolved
dateOpened: "2026-06-23"
dateStarted: "2026-06-24"
dateResolved: "2026-06-24"
graduatedTo: 099
tags: []
---

# webeverything.config author surface + per-dimension config loader/resolver

Build the project author surface ratified by #1662: a single root config keyed per dimension (any key extractable to its own file) plus the per-dimension loader/resolver that composes each dimension's flavor-extends chain (nearest-wins, lazy) and feeds it to that dimension's registry/consumer. Includes the config file format + flavor packaging. Scope: the project-facing config surface and its runtime wiring; the per-dimension strategy registries themselves are owned by #227/#080/#798/theme. Filesystem-colocated per-component scope discovery is a follow-on extension, not in this slice.

## Progress (batch-2026-06-23-1725-1665)

Built the `webeverything.config` author surface + per-dimension resolver (#1662 ratification), homed at a new top-level `we:config/`:

- `we:config/defineConfig.ts` — the Layer-2 author surface: `WebEverythingConfig` (one object keyed per dimension; the 4 known dims typed to their own flavor-id union — a theme descriptor cannot go in autoDefine's slot, the **compiler-invariant separation**), `defineConfig()` (identity + validation), `extendsFlavor(flavors, overrides?)` (the ordered nearest-first extends-chain descriptor), `DimensionEntry`/`DimensionPointer` types + guards.
- `we:config/resolveDimension.ts` — the generic per-dimension resolver: `DimensionResolver` plug-in interface, `resolveDimension()` (ordered nearest-wins, lazy — no merged blob), and `resolveConfig()` (the #1662 step-5 **discovery view** — resolves each dimension independently, **NO cross-dimension merge**). The string-pointer (extract-to-file) case is documented as the loader's follow-on.
- `we:config/platformFlavor.ts` — the WE platform flavor (Layer 1). The `autoDefine` dimension is wired **end-to-end over the real `we:blocks/renderers/auto-define/CustomAutoDefineRegistry.ts`**: `fromExtends` builds `new CustomAutoDefineRegistry({ extends: bases })` nearest-first and lets the core `CustomRegistry.extends` walk do nearest-wins (proving the kernel #1662 generalizes); the other dims (renderStrategy #080, codegenSoT #798, theme) are descriptor-level placeholders (their registries are owned elsewhere, out of scope) with a `createScalarFlavorResolver` realizing the same ordered nearest-wins over plain values.
- `we:config/index.ts` — public barrel. `we:config/__tests__/config-resolve.test.ts` — 24 tests (validation, descriptor shape, scalar + real-registry nearest-wins, multi-base order, no-cross-dim-merge, pointer/inline). Added the `config/**/__tests__/` glob to `we:vitest.config.ts`.

Scope held to #1662: the surface + runtime wiring; the per-dimension strategy registries stay owned by #227/#080/#798/theme. Filesystem-colocated per-component scope discovery is a documented follow-on. Gate: 0 errors; 24 tests green. Cites `we:docs/agent/platform-decisions.md#config-extends-platform-default`.
