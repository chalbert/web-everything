---
kind: task
parent: "1684"
status: resolved
blockedBy: []
dateOpened: "2026-06-24"
dateResolved: "2026-06-24"
graduatedTo: 1684
tags: []
---

# webrouting sitemap.xml emitter

we:webrouting — derive a crawler sitemap (sitemaps.org/0.9 XML) from the route-map projection. A facade over routes[].path: emit one <url> per static route. Per #1688 Fork 1 (a), parametric routes (/users/:id) are EXCLUDED by default (never fabricated — a literal :id or synthetic /users/0 is sitemap-invalid and SEO-poisoning) and a build-time notice surfaces each skipped route; concrete URLs for them arrive only via the opt-in param-source hook (#sibling slice). Ships derivation + conformance vectors. Blocked by the emitter registry+builder (#1736). Codified in #faithful-derivation-exclude-not-fabricate.

## Progress (batch-2026-06-23-1725-1665) — DONE

Built the sitemap.xml emitter — the first concrete `RouteMapEmitter` over the #1736 registry:
- `we:blocks/router/sitemap-emitter.ts` — `createSitemapEmitter({ baseUrl })`: a facade over `routes[].path` emitting sitemaps.org/0.9 XML, one `<url>` per **static** route. Per #1688 Fork 1a + `#faithful-derivation-exclude-not-fabricate`: **parametric** routes (`:id`/`*`/`{}`) and error-boundary routes are **EXCLUDED by default and never fabricated** (a literal `:id` or synthetic `/users/0` is sitemap-invalid + SEO-poisoning); excluded paths are **surfaced** in `skipped` (the build-time notice), not silently dropped. Origin+path joined with one slash; loc XML-escaped. Pure data (RouteMap → XML) — WE owns the emitter + vectors.
- `we:blocks/__tests__/unit/route-sitemap-emitter.test.ts` — 7 conformance vectors (static included / parametric+error-boundary skipped, no-fabrication, well-formed 0.9 doc, slash-join + escape, empty/all-parametric, `isParametricPath`, and registry-peer plug-in over a built map). Exported from `we:blocks/router/index.ts`.

Concrete URLs for parametric routes arrive only via the opt-in param-source hook (a sibling slice). Cleared the stale `blockedBy: 1736`. Gate 0 errors.
