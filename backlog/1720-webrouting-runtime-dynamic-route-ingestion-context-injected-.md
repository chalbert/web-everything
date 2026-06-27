---
kind: story
size: 8
parent: "1684"
status: open
locus: frontierui
blockedBy: ["1897"]
dateOpened: "2026-06-23"
dateStarted: "2026-06-27"
tags: []
---

# webrouting runtime/dynamic route ingestion — context-injected route objects + lazy component-from-URL

> **Stop (batch-2026-06-27, stop-rule-4 — a sub-fork surfaced mid-build).** Building against #1823's
> ratified mechanism, the **lazy `route:component`** half hit an **undesigned sub-call #1823 did not
> settle**: how an imported component *module* (a `() => import()` thunk / bare specifier) maps to a stamped
> custom-element *tag* — `fui:blocks/router/elements/RouteViewElement.ts:498` stamps by cloning a
> `<template>`, so it needs a concrete tag, but a thunk yields a module. Filed as decision **#1897**
> (`blockedBy` repointed `["1823"] → ["1897"]`); making the module→tag call silently to force the build would
> violate "never quietly make a design call to force batchability". Released unbuilt to avoid a half-build
> under a forced design call.
>
> **Split note for the builder:** the **runtime-route-object ingestion half is build-ready** and fully
> specified by #1823 — the `customContexts:routes` injector provider (new `ProviderTypeMap` key) + a settable
> `routes` property (the getter exists at `fui:blocks/router/elements/RouteViewElement.ts:48`) + the
> three-surface merge under a `mergePrecedence` config-extends-default (default `static-first`, first-match-
> wins + a `console.warn` shadowing diagnostic; nested route-view **merges**, never shadows) + name-DI-default
> / inline-override resolution for guard/loader. Only the **lazy component-from-URL** sub-facet is blocked on
> #1897. Slice this story A (ingestion, build now) / B (lazy component, blocked) if a build-now sliver is
> wanted — the data `route:loader` already stays independent and eager, so A stands alone.

route-view ingests routes only from static child <template route> today (parseRouteDefinitions over the light DOM). This story adds a runtime ingestion path for dynamic routes: route objects supplied programmatically through context (the same @routeLoader/@routeGuard seam route-view already consults), plus lazy component-from-URL loading (e.g. a route:module attr deferring a code-split module until match). Static and dynamic routes stay disjoint sets, so single-SoT per route holds. Reuses the serializable route-map schema (ratified in #1685, built in #1721) as the INPUT contract — not just #1721's derived output. Blocked on #1721 delivering that schema. Likely spawns its own mechanism decision (context-provider shape, lazy-attr design, static/dynamic merge order) when prepared.

## Pre-flight (batch-2026-06-27-1842-1720) — its own self-flagged mechanism fork is real + open; `blockedBy: ["1877"]`

The body's "likely spawns its own mechanism decision" is confirmed **open**, not a guess: #1685 (the route-map
schema decision) ratified the projection as **this item's input contract** but **explicitly scoped the
runtime-ingestion mechanism out** — its ruling reads *"Out of scope → #1720: runtime/dynamic route ingestion …
statically-authored routes only."* And `fui:blocks/router/elements/RouteViewElement.ts` ingests **only** static
child `<template route>` today (`parseRouteDefinitions`, line 83) — it consults `customContexts:routeGuard`/
`routeLoader` but has **no route-object ingestion**. So the three sub-calls (context-provider shape, lazy
`route:module` attr, static/dynamic merge order) are genuinely undesigned. Filed as decision **#1877**;
`blockedBy` repointed `[] → ["1877"]`. **/prepare #1877**, then this builds. Not batchable until then.

## Correction (2026-06-27 /prepare) — #1877 was a duplicate; the mechanism decision is already ratified as #1823

The pre-flight above filed #1877 without seeing that the **same** mechanism decision (same parent #1684,
same three sub-calls) had already been prepared *and ratified* as **#1823** earlier the same day —
codified at `we:docs/agent/platform-decisions.md#webrouting-runtime-route-ingestion` (Fork 1 → reuse the
injector seam + `customContexts:routes` runtime shape + merge-not-shadow; Fork 2 → `route:component`
inline-thunk / bare-specifier, no mandatory registry; Fork 3 → `mergePrecedence` config-extends-default,
static-first first-match-wins + shadowing diagnostic). #1877 has been resolved as a duplicate
(`graduatedTo: 1823`) and `blockedBy` repointed `["1877"] → ["1823"]` to match #1823's codified lineage
(*"Unblocks build story #1720 (`blockedBy: ["1823"]`)"*). #1823 is **resolved**, so this story is now
unblocked — build it against the ratified mechanism. Note the body's "reuses the #1685 serializable
route-map as the INPUT contract" is **superseded** by #1823: the skeptic pass proved the #1685 projection
*cannot* be the runtime engine input (it drops `pattern`/`template`); the runtime path uses a distinct
route-object shape over the reused injector mechanism.
