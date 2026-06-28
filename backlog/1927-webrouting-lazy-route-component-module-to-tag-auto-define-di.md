---
kind: story
size: 5
parent: "1684"
locus: frontierui
status: open
dateOpened: "2026-06-28"
tags: [webrouting, lazy, auto-define, router]
---

# webrouting lazy route:component — module-to-tag auto-define dimension (slice B of #1720)

## Digest

Slice B of #1720 (split batch-2026-06-27 after slice A — runtime route-object ingestion — landed). Add the
lazy **`route:component`** facet to the router: a runtime route object's `component` = `() => import()` thunk
(JS) / bare specifier string (DOM), resolved to a stampable custom-element **tag** per the ratified #1897
auto-define dimension. The engine stays **default-less** (resolves the auto-define strategy from settings,
never a constant); the platform-preset flavor ships **on-import self-register + tag-on-route**: the lazy
module self-registers its element as an import side-effect, the **tag rides on the route value**
(`component-tag` companion / `route:component-tag` attr, never read off the module), and the engine
`await`s the load then `createElement(tag)` and **never** calls `customElements.define`. `engine-defines`
(default-export ctor → engine defines) is the per-scope override via `CustomAutoDefineRegistry` /
config-extends-default — never foreclosed. Mirrors the block loader (`fui:workbench/loader.ts:56-68`, #1731)
field-for-field. Locus FUI.

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
