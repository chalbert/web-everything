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

# webrouting prerender manifest emitter

we:webrouting — derive a prerender path-manifest (the list of routes to statically pre-render) from the route-map projection. A facade over routes[].path. Per #1688 Fork 1 (a), parametric routes are excluded by default (never fabricated) with a build-time skip notice; concrete dynamic paths arrive via the opt-in param-source hook, or a crawl-discovery variant consumes the pattern. Ships derivation + conformance vectors. Blocked by the emitter registry+builder (#1736). Codified in #faithful-derivation-exclude-not-fabricate.

## Progress

Done (resolved 2026-06-26). A concrete `RouteMapEmitter` over the #1721 route-map, mirroring the sitemap-emitter pattern (#1737):

- `we:blocks/router/prerender-emitter.ts` — `createPrerenderEmitter()` → `PrerenderManifest` (`manifest[]`, `skipped[]`, `notice`). Emits one manifest entry per **static** route; **excludes parametric + error-boundary routes by default** (#1688 Fork 1a — never fabricates `/users/0`), surfacing them in `skipped` plus a human-readable build-time `notice` that names them and points at the param-source hook (#1741). Reuses `isParametricPath` from the sitemap emitter.
- `we:blocks/__tests__/unit/route-prerender-emitter.test.ts` — 6 vectors (static-only manifest + no-fabrication + skip-notice + all-static-empty-notice + empty-map + registry-peer). 6/6 green.
- Exported from `we:blocks/router/index.ts`; plugs into the #1736 `RouteEmitterRegistry` as a peer. The opt-in concrete-path expansion is the sibling slice #1741.
