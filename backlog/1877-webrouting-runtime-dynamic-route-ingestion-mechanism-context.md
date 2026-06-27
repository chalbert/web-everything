---
kind: decision
parent: "1684"
status: open
dateOpened: "2026-06-27"
tags: []
---

# webrouting runtime/dynamic route ingestion mechanism — context-provider shape, lazy-attr, static/dynamic merge order

Blocks #1720 (its own self-flagged 'likely spawns a mechanism decision'). #1685 ratified the serializable route-map projection as #1720's INPUT contract but EXPLICITLY scoped the runtime-ingestion mechanism out (#1685 ruling: 'Out of scope -> #1720: runtime/dynamic route ingestion ... statically-authored routes only'). route-view today ingests ONLY static child <template route> via parseRouteDefinitions (fui:blocks/router/elements/RouteViewElement.ts:83); it consults customContexts:routeGuard/routeLoader but has no route-OBJECT ingestion. Three open sub-calls: (1) context-provider shape — how programmatic route objects are supplied through context (a new customContexts:routes provider? extend the existing @routeLoader seam?) keyed to the #1685 projection schema as input; (2) lazy component-from-URL — the route:module attr design deferring a code-split import until match; (3) static/dynamic merge order — how runtime-injected routes compose with static-DOM routes (disjoint sets per #1685, so single-SoT-per-route holds — but match precedence/ordering needs a rule). /prepare this, then #1720 builds. Locus: FUI.
