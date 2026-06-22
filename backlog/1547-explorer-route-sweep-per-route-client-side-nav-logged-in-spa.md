---
kind: story
size: 3
parent: "1522"
locus: frontierui
status: resolved
dateOpened: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: "fui:tools/explorer/routeSweep.ts — per-route client-side click nav (logged-in SPA route sweep)"
tags: []
---

# Explorer route-sweep: per-route client-side nav (logged-in SPA, retire harness)

Route-sweep reaches each route by goto, which reloads and drops an in-memory SPA session — so a client-routed app's logged-in routes were uncoverable per-route. Add a per-route click option: reach a route by clicking its nav selector (no reload, session preserved). Retires the fui:tools/explorer/plateau-audit.ts harness.

## Resolved (2026-06-22) — `routes` entries may be `{ path, click }`

`fui:tools/explorer/routeSweep.ts` now establishes the session ONCE up front (auth steps, or a base-URL load), then per route either `goto`s (string entry — persistent auth / MPA / public) or **clicks** a selector (`{ path, click }` entry) to navigate client-side with NO reload, so an in-memory session stays alive. `RouteEntry` in `fui:tools/explorer/authRecipe.ts` is now `string | { path, click? }`.

**Validated:** a recipe with login steps + click-routes (`{ "path": "/apps", "click": "a[route\\:link='/apps']" }`) swept plateau's **logged-in** `/apps /libraries /control-plane /governance-ui` — per-route labelled screenshots of the authed pages (Admin User shell, session intact), contrast/aria findings matching the original audit. These routes are unreachable by `goto` (plateau's in-memory session resets on reload).

This was the last capability the bespoke `fui:tools/explorer/plateau-audit.ts` had over the CLI, so that harness was **deleted** — the CLI reproduces it from an app-agnostic recipe (`--auth` steps + `routes` click-list + `--out` + `viewports`).
