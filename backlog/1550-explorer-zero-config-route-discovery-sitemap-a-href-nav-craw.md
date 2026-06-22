---
kind: story
size: 3
parent: "1522"
locus: frontierui
status: resolved
scaffoldedBy: "improve-explorer"
dateScaffolded: "2026-06-22"
dateOpened: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: "fui:tools/explorer/routeDiscovery.ts — sitemap + a[href] discovery feeding the per-route sweep; CLI `--discover` / `--max-routes`"
tags: []
---

# Explorer: zero-config route discovery (sitemap + a[href] nav crawl) for the whole-app sweep

#1524 shipped only the "supplied as config" half of the whole-app sweep — someone hand-authors the `routes` list (even #1524's own FUI-docs validation read the homepage `href`s by hand). The `fui:tools/explorer/GOAL.md` charter (principle 3) wants routes **discovered (sitemap / nav crawl) OR supplied as config**. This is the discovery half: given only a base URL, build the route list from two web-standard sources so a site with a sitemap or real anchors gets a whole-app sweep with **no hand-authored list**.

## Forcing run (the gap)

Real run `npm run explore -- http://localhost:8080/ --site` reached 20 opaque-hash states at 41% coverage but **could not enumerate which of the app's pages it missed** — the click-walk only reaches what it can click to from the seed, and the per-route sweep (`fui:tools/explorer/routeSweep.ts`) needs a list someone wrote. #1524 itself named the residual: *"A best-effort `href` crawl can augment it later."*

## Resolved (2026-06-22) — `discoverRoutes`, two app-agnostic sources, wired behind `--discover`

New `fui:tools/explorer/routeDiscovery.ts` `discoverRoutes(page, baseUrl)` merges:
1. **`/sitemap.xml`** — the sitemaps.org standard; same-origin `<loc>` entries → routes (single-level read; nested `*.xml` skipped).
2. **`a[href]` nav crawl** of the base page — the HTML standard for links; same-origin hrefs → routes.

Pure parse helpers (`sameOriginPaths`, `parseSitemapLocs`) reduce both to a same-origin, deduped, lexicographically-sorted, capped path set (always includes `/`) — deterministic run-to-run. `fui:tools/explorer/cli.ts` gains `--discover` (+ `--max-routes N`, default 40): when no explicit `routes` recipe is given it discovers once before the viewport loop and feeds the list to the existing per-route sweep. The cap is **reported, never silent** (charter: no silent caps), and discovery yielding only `/` falls back to the single-seed walk with a clear note.

No app-specific selectors/routes/framework appear in the tool — sitemap.xml and `a[href]` are universal.

**Validated on three structurally distinct apps (zero hand-authored list):** WE docs `:8080` → 80 routes (nav crawl; the sitemap's production-absolute URLs are correctly dropped as cross-origin to localhost); FUI docs `:8082` → 62 routes; plateau-app `:4000` → 21 public routes. 13 new unit tests pin the pure parsing (same-origin filter, dedupe/sort, nested-sitemap skip, cap reporting, fetch-throws resilience); explorer unit suite green (59).

**Scope / known limit:** discovery covers MPAs, static sites, and any app exposing real `href` nav or a same-origin sitemap. An app that routes purely via custom attributes with no `href` and no sitemap (a logged-in client-routed SPA) still needs the explicit `routes` recipe + auth (#1523) — the documented #1524 fallback, unchanged. Nested sitemap-index recursion is a deliberate v1 omission (the nav crawl covers the remainder).
