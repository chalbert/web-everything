---
kind: task
parent: "1684"
status: resolved
dateOpened: "2026-06-24"
dateStarted: "2026-06-26"
dateResolved: "2026-06-26"
graduatedTo: 1684
tags: []
---

# webrouting IA nav-tree emitter

we:webrouting — derive a hierarchical information-architecture nav-tree (nested menu / breadcrumb structure, mirroring @11ty/eleventy-navigation) from the route-map projection. Per #1688 Fork 2 (a), the emitter REALIZES the Navigation Intent structure axis (we:src/_data/blocks/router.json:146) rather than re-deriving an independent tree — one composed home, no second source of truth for the nav hierarchy; it falls back to pure path-nesting only when no navigation intent is declared. Pattern-preserving: consumes the /users/:id template form directly, needs no concrete URLs. Ships derivation + conformance vectors. Blocked by #1736. Codified in #faithful-derivation-exclude-not-fabricate.

## Progress

Done (resolved 2026-06-26). A concrete `RouteMapEmitter` over the #1721 route-map, mirroring the sitemap-emitter pattern (#1737):

- `we:blocks/router/nav-tree-emitter.ts` — `createNavTreeEmitter({ structure? })` → `NavTreeResult` (`structure`, `derivedFrom`, `tree[]`, `skipped[]`). **Realizes the navigation-intent `structure` axis** (`hierarchical` | `lateral` | `linear`, the `we:src/_data/intents/navigation.json` vocabulary): hierarchical nests each route under the longest **declared** path-prefix (home `/` stays a sibling root, not a universal parent); lateral/linear are flat (peers / ordered sequence). With no `structure` supplied it falls back to path-nesting (`derivedFrom: 'path-nesting-fallback'`). **Faithful derivation** — never fabricates a missing intermediate level (orphan route → root); **pattern-preserving** — keeps parametric routes in URLPattern template form (unlike sitemap, which excludes them); excludes only error-boundary routes (surfaced in `skipped`).
- `we:blocks/__tests__/unit/route-nav-tree-emitter.test.ts` — 8 vectors (hierarchical nesting + template-preservation + no-fabrication + error-boundary exclusion + lateral/linear flat + fallback + registry-peer). 8/8 green.
- Exported from `we:blocks/router/index.ts`; plugs into the #1736 `RouteEmitterRegistry` as a peer.
