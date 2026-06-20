---
kind: story
size: 3
parent: "1089"
status: resolved
blockedBy: ["1105"]
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:plugs/webstates/CustomChangeStrategyRegistry.ts"
tags: []
---

# webstates: CustomChangeStrategyRegistry (per-scope selection)

we:plugs/webstates/CustomChangeStrategyRegistry.ts extends HTMLRegistry (mirror we:plugs/webstates/CustomStoreRegistry.ts) with an active() nearest-scope resolver + observe() helper per spec we:src/_includes/project-webstates.njk:180-195. Demo: two scoped registries resolve the nearest strategy.

## Progress

Shipped `we:plugs/webstates/CustomChangeStrategyRegistry.ts` — per-scope change-strategy selection:
- `define(strategy, asActive?)` registers a `CustomChangeStrategy` by its own `.key` (value-keyed); first
  define (or `asActive`) becomes the scope's active strategy. `setActive(key)`/`activeKey` for explicit
  control.
- `active()` resolves **nearest-scope-wins**: own selection → nearest enclosing scope's `active()` (walks
  the `extends` parents) → the native-first `nativeChangeStrategy` baseline. `observe(target, onChange)` is
  the conformant-store helper = `active().track(...)` (spec §"Per-Scope Selection", njk:180-195).
- `createDefaultChangeStrategyRegistry()` pre-loads the native strategy active (parity with
  `createDefaultGuardRegistry`).

**Base correction (remediate-in-place, not a design fork):** the card said "extends HTMLRegistry (mirror
CustomStoreRegistry)", but a change strategy is a value *instance* keyed by `.key`, not a DOM-node
*class* — HTMLRegistry's constructor-bimap + `new(...)` generic constraint don't fit it. Built on
`CustomRegistry` instead, the established value-keyed base (`CustomGuardRegistry` /
`CustomValidityMergeRegistry` / `CustomValidatorResolutionRegistry`), with scope nesting via `extends`
exactly as those do. Settled pattern, no decision made.

Unit test `we:plugs/webstates/__tests__/unit/CustomChangeStrategyRegistry.test.ts` 7 green (define/active, first-active +
override, native fallback, two scoped registries resolve nearest, setActive, observe, default factory). WE
`check:standards` 0 errors.
