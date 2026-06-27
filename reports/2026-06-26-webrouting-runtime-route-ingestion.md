# webrouting runtime/dynamic route-ingestion mechanism — decision-prep grounding (#1823)

**Date:** 2026-06-26 · **Grounds:** decision [#1823] (parent #1684) · **Unblocks:** #1720 · **Input contract:** #1685 / #1721

## What this decision is

`route-view` ingests routes only from static child `<template route>` today. #1720 wants a runtime path
(dynamic route objects via context + lazy component-from-URL). Its body flagged that this "likely spawns
its own mechanism decision" — so #1823 settles three calls before #1720 builds: the provider/context
shape for dynamic route objects, the lazy component-from-URL attr, and the static/dynamic merge order.

## Grounding (real tree — `we:` = webeverything, `fui:` = frontierui)

### Current mechanism (static-only)

- `we:blocks/router/types.ts:194-232` — `parseRouteDefinitions(container, base)` runs
  `querySelectorAll('template[route]')` over the light DOM, reading `route`, `route:guard`,
  `route:guard:leave`, `route:loader`, `route:outlet`, `route:error`; compiles `new URLPattern({pathname})`
  per template (`:211`).
- `we:blocks/router/types.ts:131-148` — `RouteDefinition` carries **`pattern: URLPattern` +
  `template: HTMLTemplateElement`** (both non-serializable) plus the serializable string fields. Crucially
  `guard`/`loader` are **names (strings)**, late-resolved against a provider.
- **Matching is declaration-order, first-match-wins** (`we:blocks/router/types.ts:243-266`) — NOT
  specificity ranking (unlike React Router / Vue / TanStack; like Angular / bare URLPattern).

### The provider/DI seam (`@routeLoader`/`@routeGuard`)

Resolution is late, by name, through the injector chain:
- `fui:blocks/router/elements/RouteViewElement.ts:484-493` (`#resolveLoader`) +
  `:463-478` (`#resolveGuardFn`) call `InjectorRoot.getProviderOf(this, 'customContexts:routeLoader'|'…routeGuard')`
  → a `Record<string, fn>`, then index by the route's string name.
- `fui:plugs/webinjectors/InjectorRoot.ts:115-126` — `getProviderOf` walks the chain and returns the
  **first** provider found (first-found-wins, no merge).
- Registered as a plain dict on an injector: `documentInjector.set('customContexts:routeLoader', {…})` —
  `fui:demos/declarative-spa-router.html:253,272`. So the seam is **a name→function map provided via the
  injector context protocol**, not an attribute or a global registry. It supplies the *functions* a route
  name resolves to — it has **no slot for route definitions** (path + pattern + content).

### The #1685 schema is an OUTPUT projection (verified — drops template/pattern)

- `we:blocks/router/route-map.ts:28-54` — `RouteMapEntry`/`RouteMap`: ordered, string-only fields.
- `we:blocks/router/route-map.ts:57-88` — `buildRouteMap` is a **faithful derivation** that explicitly
  **drops** `pattern: URLPattern` + `template: HTMLTemplateElement` ("excludes what it cannot serialize,
  never fabricates").
- `we:blocks/router/route-map.ts:91-159` — a **closed** `ENTRY_KEYS` set (`path, guard, guardLeave, loader,
  outlet, isErrorBoundary`); the validator **rejects any unknown key** (e.g. a leaked `pattern`, or a
  `module`).

This is the decisive finding for Fork 1: the #1685 schema cannot be the *runtime engine input*. The engine
stamps `template.content.cloneNode` (`fui:blocks/router/elements/RouteViewElement.ts:498`) and matches on
`pattern.exec` — both fields the projection *drops*. And a `route:module` field would be *rejected* by the
closed key set. The #1685 RouteMap is the serialization/transport contract, **not** the live input shape.

## Prior art (web survey)

| Router | dynamic register | lazy module | merge/precedence | naming |
|---|---|---|---|---|
| React Router v6.4+/7 | recreate route-object array | `route.lazy` → module (`{loader, Component}`); component defers, loader eager | specificity ranking | `lazy` |
| Vue Router 4 | `router.addRoute`/`removeRoute(name)`; add ≠ activate | `component: () => import()` | specificity; ties → insertion order | `addRoute`; "lazy loading" |
| Angular | `resetConfig(routes)` whole-replace | `loadComponent`/`loadChildren` → `() => import()` | declaration order | `loadComponent` |
| TanStack | code-based tree; `Route.lazy()` | lazy loads non-critical props; loader eager | specificity | `lazy` |
| Navigation API + URLPattern | own an ordered table | userland `await import()` | first-match-in-order | platform ships matching only |

Cross-cutting: (1) the import is almost always **inline on the route** (`() => import()`), named `lazy`/
`component`/`loadComponent`; (2) modern matchers rank by specificity, but WE matches by declaration order;
(3) state-of-art splits **critical (loader, eager) vs non-critical (component, deferred)**.

## Skeptic pass (refute-only sub-agent) — verdicts folded

- **Fork 1 — REFUTED.** A serializable RouteMap (#1685 output projection) cannot be the runtime input: the
  closed `ENTRY_KEYS` rejects a `module` field (`we:blocks/router/route-map.ts:91-159`) and the projection
  drops `template`, which the engine must stamp (`fui:blocks/router/elements/RouteViewElement.ts:498`). Plus
  `getProviderOf` first-found-wins (`fui:plugs/webinjectors/InjectorRoot.ts:115-126`) silently shadows the
  whole route *table* across nested injectors — benign for a fn-map, data-loss for the route set.
  **Folded:** the runtime input is a *distinct runtime route-object shape* carried via the existing injector
  mechanism, not the #1685 projection; #1685 stays the serialization contract.
- **Fork 2 — SURVIVES-WITH-AMENDMENT.** No attr collision (`we:blocks/router/types.ts:223-227` has no
  `route:module`), but forcing the lazy module through a `customContexts:routeModule` name-registry is
  ceremony with no payoff in the JS/runtime path, where an inline `() => import()` thunk is trivially
  expressible and matches all prior art. **Folded:** drop the provider-map; accept an inline thunk for the
  JS path + a bare specifier string for the serializable/DOM path; rename to `route:component` (disambiguates
  from the *data* `route:loader`).
- **Fork 3 — SURVIVES-WITH-AMENDMENT.** Static-wins-via-concatenation forecloses runtime override of an
  authored route with no escape hatch, and #1720's "disjoint sets" premise is asserted, not enforced.
  **Folded:** keep static-first as the default tiebreak, but add a **shadowing diagnostic** (warn when a
  dynamic pattern is shadowed by a static one — mirroring the existing `[Router] Invalid route pattern`
  warning at `we:blocks/router/types.ts:213`) and require #1720 to land a concrete disjointness-enforcement
  or override use case before ratify.

## Cross-fork hinge

The original "rule the lazy module as a string so Fork 1 can reuse the #1685 schema unchanged" hinge
**collapsed** (Fork 1 refuted). The real hinge: the runtime route-object shape (Fork 1) carries the
lazy-component reference (Fork 2) — an inline thunk or a specifier string — as a field the *closed* #1685
schema deliberately does not. Author Forks 1 + 2 together.
