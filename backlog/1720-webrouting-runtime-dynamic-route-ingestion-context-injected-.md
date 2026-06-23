---
kind: story
size: 8
parent: "1684"
status: open
blockedBy: ["1685"]
dateOpened: "2026-06-23"
tags: []
---

# webrouting runtime/dynamic route ingestion — context-injected route objects + lazy component-from-URL

route-view ingests routes only from static child <template route> today (parseRouteDefinitions over the light DOM). This story adds a runtime ingestion path for dynamic routes: route objects supplied programmatically through context (the same @routeLoader/@routeGuard seam route-view already consults), plus lazy component-from-URL loading (e.g. a route:module attr deferring a code-split module until match). Static and dynamic routes stay disjoint sets, so single-SoT per route holds. Reuses the serializable route-map schema from #1685 as the INPUT contract (not just #1685's derived output). Blocked on #1685 fixing that schema. Likely spawns its own mechanism decision (context-provider shape, lazy-attr design, static/dynamic merge order) when prepared.
