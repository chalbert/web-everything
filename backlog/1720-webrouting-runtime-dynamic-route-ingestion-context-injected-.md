---
kind: story
size: 8
parent: "1684"
status: open
blockedBy: ["1877"]
dateOpened: "2026-06-23"
tags: []
---

# webrouting runtime/dynamic route ingestion — context-injected route objects + lazy component-from-URL

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
