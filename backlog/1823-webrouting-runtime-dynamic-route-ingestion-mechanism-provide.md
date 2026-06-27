---
kind: decision
parent: "1684"
status: open
dateOpened: "2026-06-27"
tags: [webrouting]
---

# webrouting runtime/dynamic route-ingestion mechanism (provider shape, lazy-attr, merge order)

#1720 adds a runtime ingestion path to route-view (dynamic route objects via context + lazy component-from-URL), but its own body flags it 'likely spawns its own mechanism decision when prepared': the context-provider shape, the lazy route:module attr design, and the static/dynamic merge order are undecided. The serializable route-map schema (#1685 ratified, #1721 built) is the resolved input contract. Settle the ingestion mechanism before #1720 builds.

## What you decide

`route-view` ingests routes only from static child `<template route>` today (`parseRouteDefinitions` over the light DOM). Before #1720 can build the runtime path, three mechanism calls:

1. **Context-provider shape** — what does the `@routeLoader`/`@routeGuard` seam accept for *dynamic* route objects? The existing provider contract reused, vs an extended shape carrying the #1685 serializable route-map as the input.
2. **Lazy component-from-URL** — how a `route:module` (or similar) attr defers a code-split module until match: the attr's name/semantics, and whether the loader is the same provider seam or a separate one.
3. **Static/dynamic merge order** — static (`<template route>`) and dynamic (context-supplied) routes stay disjoint sets (single-SoT per route holds), but the resolution/precedence order when both exist must be ruled.

Filed from the batch-20260626-1811-1817-1819 close to home #1720's buried mechanism fork (`blockedBy: ["1823"]`) instead of leaving it as a prose aside the selector can't see. **Unprepared** (Tier B: discuss, don't auto-build) — `/prepare` to survey route-view's current provider seam + the #1685 schema and bring a bold default per fork to DoR. Resolving this unblocks #1720.
