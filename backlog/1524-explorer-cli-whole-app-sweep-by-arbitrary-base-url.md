---
kind: story
size: 5
parent: "1522"
locus: plateau-app
status: resolved
dateOpened: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: "plateau-app:tools/explorer/routeSweep.ts — explicit-route whole-app sweep (per-route audit + route-labelled bundle)"
tags: []
---

# Explorer CLI: whole-app sweep by arbitrary base URL

Generalize the nav-aware sweepSite beyond the WE/FUI docs site to crawl an arbitrary app by base URL (incl. configurable probe bases / :4000), discovering and visiting all reachable routes — not just one seed's in-place states.

## Where / prototype

`plateau-app:tools/explorer/cli.ts` hardcodes probe bases to `:3001/:8082/:8080` (an absolute URL works verbatim, but there's no auto-discovery for another app), and `plateau-app:tools/explorer/docsSiteHarness.ts` `sweepSite` is tuned to the docs-site nav shape. The plateau prototype enumerated the route set explicitly; productize a base-URL sweep that discovers routes (sitemap / nav crawl) and visits each. Pairs with #1523 — most routes worth sweeping on a real app are behind auth.

## Resolved (2026-06-22) — explicit `routes` list, audited per route, bundle grouped by route

New `plateau-app:tools/explorer/routeSweep.ts` `sweepRoutes` audits each route in an explicit list (in the recipe's new `routes` field, resolved against the base URL): navigate → run the Layer-1 oracle bus → (with `--out`) capture a route-labelled screenshot + rich a11y detail. The state id IS the route (`route:/apps`), so the bundle groups by route, not an opaque DOM hash. `plateau-app:tools/explorer/cli.ts` switches to this mode when the recipe has `routes`; auth (#1523) applies per route.

**Why an explicit list, not a link-crawl** (the design call): grounding showed plateau's sidebar nav uses a custom `route:link` attribute with NO `href`, so an `a[href]` crawl can't discover its routes — the explicit list is the general mechanism that works regardless of how an app routes. A best-effort `href` crawl can augment it later.

**Validated on two apps:** plateau public routes (`/home /login /pricing /terms /privacy`) → 5 route-labelled screenshots + per-route contrast tables matching the original audit; FUI docs site (`:8082`, routes discovered from its homepage `href`s) → 4-route bundle. Suite green (88).

**Scope / known limit:** the per-route reach is `goto` — general for persistent-auth (storageState/cookie), MPA, and public routes. A client-routed in-memory SPA (plateau's *logged-in* pages) drops its session on the `goto` reload; those are covered by the #1523 auth click-walk (which never reloads) rather than this per-route list. A per-route *client-side* nav (reach a route by clicking its nav link) is the remaining nicety; until then `plateau-app:tools/explorer/plateau-audit.ts` is retained for plateau's logged-in per-route bundle.
