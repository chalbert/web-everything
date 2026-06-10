---
type: issue
workItem: story
status: resolved
blockedBy: ["227"]
dateOpened: "2026-06-09"
size: 5
dateStarted: "2026-06-10"
dateResolved: "2026-06-10"
graduatedTo: customRenderStrategy
tags: [refactor, registry, platform-config, render-strategy, change-strategy, consistency]
relatedProject: webcomponents
crossRef: { url: /projects/webcomponents/#protocol-render-strategy, label: Render Strategy Protocol }
---

# Align strategy registries to the config-extends-platform default model

Close-out leftover from #227. The ruling there established the canonical rule
(`[[feedback_config_extends_platform_default]]`): **the tool carries no default — the
default-strategy selection comes from a platform config the project extends**, via the core
`CustomRegistry` inheritance chain.

`blocks/renderers/jsx/render-strategy/CustomRenderStrategyRegistry.ts` **violates** this: it rolls its
own `Map` + `#defaultName` ("first registered becomes the default") + a `parent` pointer instead of
extending `CustomRegistry`. The default is baked into the tool.

## Scope

- **Refactor `CustomRenderStrategyRegistry`** to extend core `CustomRegistry` (own → extended chain);
  move the default-strategy selection (`declarative-static`) out of the tool and into a platform config
  flavor the project extends. Preserve nearest-scope-wins via the extends chain rather than a bespoke
  `parent`.
- **Audit `CustomChangeStrategyRegistry`** (Change Tracking, `webstates`) for the same anti-pattern;
  align if present.
- Sweep for any other registry that bakes a `#defaultName` / first-registered-wins default into the
  tool rather than inheriting it from an extended config.

## Done when

- Render-strategy registry extends `CustomRegistry`; no tool-baked default; default supplied by an
  extended platform config; existing render-strategy tests green.
- Change-strategy audited (aligned or documented as already-conformant).
- No remaining tool-baked strategy defaults outside an extends chain (grep clean).

Pure refactor — no behavior change for a project on the default flavor. Surfaced as a leftover from
#227, not part of that decision's scope.

## Progress

- **Status:** resolved (2026-06-10)
- **Render-strategy registry refactored — `blocks/renderers/jsx/render-strategy/CustomRenderStrategyRegistry.ts`:**
  `CustomRenderStrategyRegistry` now **extends the core `CustomRegistry<CustomRenderStrategy>`** (own →
  extended chain, `localName = 'customRenderStrategy'`), replacing the bespoke private `Map` +
  first-registered-wins `#defaultName` + hand-rolled `parent` pointer. `register()` no longer seeds a
  default; `setDefault()` / extending a flavor is the only way. `defaultName` resolves own → nearest
  extended config (nearest-config-wins, same semantics as the old `parent` walk); `has`/`get`/`keys`
  come from `CustomRegistry` and walk the chain. Error messages preserved (`Unknown render strategy: …`,
  `No render strategy registered and no default set.`).
- **Default moved out of the tool into a flavor:** `createDeclarativeStaticFlavor()` is the native-first
  platform config (declarative-static registered + set default); the module-level `renderStrategyRegistry`
  is now a project config that **extends** it (`new CustomRenderStrategyRegistry({ extends: [flavor] })`)
  — so `render()` still defaults to declarative-static, but the default comes from config, not the tool.
  No behavior change for a project on the default flavor (verified by the unchanged `render()` tests).
- **Change-strategy audit:** **no `CustomChangeStrategyRegistry` exists** in the repo (grep across
  `plugs/`+`blocks/` finds only the references in doc comments). Documented as not-present — nothing to
  align. (When Change Tracking lands its registry, build it on the same `CustomRegistry`-extends model.)
- **Sweep result:** the render-strategy registry was the only tool that baked a default via
  first-registered-wins seeded into a module singleton — now fixed. The sibling strategy registries
  (`CustomValidityMergeRegistry` #215, `CustomValidatorResolutionRegistry` #224) already **extend
  `CustomRegistry`** and ship `#defaultKey = null`; their default is set by their `createDefault…()`
  **factory** (the config layer, called in bootstrap), not hardcoded in the class — so they are
  config-extends-conformant and left as-is. (They keep a first-registered-wins *convenience* in
  `define`, but it never bakes a tool default because the factory always passes `asDefault` explicitly;
  the newer auto-define registry #242 drops even that convenience.) No tool ships a non-null default
  literal — grep clean.
- **Tests:** `renderStrategy.test.ts` updated for the new contract (bare registry has no default;
  default inherited by extending the flavor; per-scope override via `extends`) — 14 green. Full unit
  suite green (2010).
