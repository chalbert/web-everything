---
kind: story
size: 8
parent: "1684"
status: open
blockedBy: []
dateOpened: "2026-06-23"
tags: []
---

# webrouting runtime/dynamic route ingestion — context-injected route objects + lazy component-from-URL

route-view ingests routes only from static child <template route> today (parseRouteDefinitions over the light DOM). This story adds a runtime ingestion path for dynamic routes: route objects supplied programmatically through context (the same @routeLoader/@routeGuard seam route-view already consults), plus lazy component-from-URL loading (e.g. a route:module attr deferring a code-split module until match). Static and dynamic routes stay disjoint sets, so single-SoT per route holds. Reuses the serializable route-map schema (ratified in #1685, built in #1721) as the INPUT contract — not just #1721's derived output. Blocked on #1721 delivering that schema. Likely spawns its own mechanism decision (context-provider shape, lazy-attr design, static/dynamic merge order) when prepared.
