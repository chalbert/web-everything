---
kind: story
size: 5
parent: "1684"
locus: frontierui
status: resolved
dateOpened: "2026-06-28"
dateStarted: "2026-06-28"
dateResolved: "2026-06-28"
graduatedTo: "fui:blocks/router/componentAutoDefine.ts"
codifiedIn: "docs/agent/platform-decisions.md#lazy-route-component-auto-define-default"
tags: [webrouting, lazy, auto-define, router]
---

# webrouting lazy route:component — module-to-tag auto-define dimension (slice B of #1720)

## Digest

Slice B of #1720. Add the lazy **`route:component`** facet to the router: a runtime route's `component` =
`() => import()` thunk (JS) / bare specifier string (DOM), resolved to a stampable custom-element **tag** per
the ratified #1897 auto-define dimension. The engine stays **default-less**; the platform-preset flavor ships
**on-import self-register + tag-on-route** — the lazy module self-registers, the **tag rides on the route**
(never read off the module), the engine `await`s the load then `createElement(tag)` and **never** calls
`customElements.define`. `engine-defines` (default-export ctor → engine defines) is the per-scope override.
Mirrors the block loader (`fui:workbench/loader.ts:56-68`, #1731). Locus FUI.

## Why this is separate (split batch-2026-06-27 from #1720)

#1720 was sized (8) when this lazy half was **blocked** on a then-open mechanism decision; that decision
ratified as **#1897** (`we:docs/agent/platform-decisions.md#lazy-route-component-auto-define-default`) only
after the sizing, so the full item's buildable scope grew to two ratified mechanisms. Slice A (runtime
route-object ingestion via the `customContexts:routes` provider + settable `routes` property + merge
precedence + name-DI/inline resolution, fully specified by #1823) landed in #1720 and **stands alone** (its
renderable is a live `template`). This slice adds the `component` renderable. The body of #1720 explicitly
sanctioned the A/B split.

## Scope (build-ready — #1897 ratified)

1. **Extend the runtime route shape + `RouteDefinition`** with `component` (thunk/specifier) + `componentTag`
   in `fui:blocks/router/types.ts` (`RuntimeRouteObject`/`compileRuntimeRoutes` already compile the rest; a
   component-route needs no `template`, so relax the slice-A "no template → skip" guard for component routes).
2. **Auto-define resolution** — a default-less engine resolving the strategy from settings (the
   `CustomRegistry.extends` precedent); ship the `on-import self-register + tag-on-route` preset default and
   the `engine-defines` override via a `CustomAutoDefineRegistry` (config-extends-platform-default, #227).
3. **Stamp a component route** — in `fui:blocks/router/elements/RouteViewElement.ts` `#stampAllRoutes`,
   branch: a component route `await`s the load (thunk / `import(specifier)`) then `createElement(componentTag)`
   and appends (vs cloning `template.content`). Mirror `fui:workbench/loader.ts:56-68`.
4. **Tests** — lazy thunk + bare-specifier resolution, tag-on-route (never `mod.tag`), engine-default-less +
   preset on-import default, `engine-defines` override path. `check:standards` + the router suite green.

Lineage: #1720 (slice A — runtime ingestion), #1897 (lazy auto-define ruling), #1823 (runtime ingestion
mechanism), #1731 (block-loader precedent), epic #1684.

## Resolution (batch-parallel-2026-06-28)

Shipped in FUI (locus):

1. **`fui:blocks/router/types.ts`** — `RuntimeRouteObject`/`RouteDefinition` gained `component`
   (`RouteComponent` = `() => import()` thunk | bare specifier string) + `componentTag`; added
   `loadRouteComponent()` (thunk-invoke vs `import(/* @vite-ignore */ specifier)`). `compileRuntimeRoutes`
   relaxed the slice-A "no template → skip" guard to "no renderable → skip" (template **or** component), and
   skips a component route lacking `componentTag` (tag rides on the route — #1897, never `mod.tag`).
2. **`fui:blocks/router/componentAutoDefine.ts`** (new) — the **default-less** route-component auto-define
   dimension: `RouteComponentAutoDefineRegistry extends CustomRegistry` (config-extends-platform-default,
   mirrors `CustomAutoDefineRegistry` field-for-field), strategies `tagOnRouteStrategy` (preset default —
   `await load()` self-registers, `createElement(componentTag)`, engine **never** defines) and
   `engineDefinesStrategy` (override — default-export ctor → idempotent `defineElement`). `createPlatformRouteComponentFlavor()`
   ships `tag-on-route` default with `engine-defines` reachable; bare registry has **no** default.
3. **`fui:blocks/router/elements/RouteViewElement.ts`** — `#stampAllRoutes` is now `async` (awaited at the
   single call site); a component route resolves the strategy from `customContexts:routeComponentAutoDefine`
   (falling back to the preset flavor — preset default, not an engine constant) and `await`s
   `strategy.stamp(...)`. Stamped-node tracking keys on `isComponentRoute`, **not** `instanceof
   DocumentFragment` (unreliable across realms — would leak un-unstampable nodes).
4. **Tests** — 8 new cases in the router suite: thunk + bare-specifier (data: URL) resolution,
   tag-on-route (ignores a `mod.tag` export), engine-defines override (engine defines the default-export
   ctor), missing-`componentTag` skip, and registry default-less / config-extends / setDefault-override
   (`fui:blocks/__tests__/unit/router/RouteViewElement.test.ts`). Router suite green (40/40); `npm run
   check:standards` green.
