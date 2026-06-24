---
kind: story
size: 8
status: resolved
dateOpened: "2026-06-24"
dateStarted: "2026-06-24"
dateResolved: "2026-06-24"
graduatedTo: "config/index.ts (WE contract) + fui:config/ (resolver impl)"
relatedTo: ["1779", "1702", "1662", "1282"]
locus: frontierui
tags: [config, frontierui, relocation, contract-carve]
---

# Carve we:config/ into WE contract + relocate the resolver impl to FUI (#1282/#1702 fix)

we:config/ (the #1702 webeverything.config surface) put runtime resolver impl in WE, violating #1282 (WE holds zero standard impl). Carve it three ways: the CONTRACT — DimensionResolver interface, WebEverythingConfig schema + guards, defineConfig author surface, native-first default declarations, vectors — stays WE; the RESOLVER IMPL — resolveDimension/resolveConfig runtime + we:config/platformFlavor.ts factories + autoDefineResolver, with its tests — relocates to FUI as the impl of that contract; a project's config VALUES are product-layer. Reconciles #1662's plateau-app locus (it marked the consumer, not the impl home). Prereq for #1779: leaves no WE-resident consumer of the auto-define registry.

## Progress

- **Status:** resolved.
- **Done:**
  - **WE = contract only** (`we:config/`, published as `@webeverything/config`):
    `we:config/defineConfig.ts` (schema + guards + `defineConfig`/`extendsFlavor` author surface) — now
    types `AutoDefineFlavorName = string` so WE imports **no** auto-define registry;
    `we:config/resolverContract.ts` (the `DimensionResolver` interface, carved out of the old
    `we:config/resolveDimension.ts`); `we:config/platformDefaults.ts` (native-first default
    *declarations* — `PLATFORM_AUTO_DEFINE_FLAVOR`, `PLATFORM_FLAVOR_DEFAULTS`, `AutoDefineOverrides`,
    data-only, no registry construction); `we:config/index.ts` re-points to the contract;
    `we:config/__tests__/config-contract.test.ts` keeps the author-surface vectors (9 tests, green).
  - **FUI = resolver impl** (`fui:config/`): `fui:config/resolveDimension.ts`
    (`resolveDimension`/`resolveConfig` runtime + `UnresolvableDimensionError`),
    `fui:config/platformFlavor.ts` (`autoDefineResolver` + `createScalarFlavorResolver`),
    `fui:config/index.ts`, `fui:config/__tests__/config-resolve.test.ts` (15 tests, green) — importing
    the contract from `@webeverything/config`.
  - **Wiring:** added `@webeverything/config` alias to `fui:tsconfig.json` + `fui:vite.config.mts` +
    `fui:vitest.config.ts` (+ `fui:config/**/*` to the tsconfig include + the `config` test glob to the
    vitest include). The FUI resolver imports the still-WE-resident registry via a relative sibling path;
    a **transient** `@frontierui/plugs → fui:plugs/` self-alias was added to the three FUI configs to
    resolve the registry's own `@frontierui/plugs/*` import (mooted by #1779, annotated to remove it).
- **Gates:** WE `check:standards` 0 errors; WE + FUI vitest green; FUI `tsc --noEmit` adds 0 new errors
  (2 pre-existing unrelated errors in `fui:plugs/webexpressions/` / `fui:plugs/webstates/`, confirmed via stash).
- **Project config VALUES = product layer:** no artifact to move — there is no WE-resident project config
  values file; values live in a product's `webeverything.config.*` (out of this repo). Documented, no code.
- **Unblocks #1779** (registry relocation): no WE file consumes the auto-define registry anymore.
