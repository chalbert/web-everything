---
kind: task
parent: "1237"
status: resolved
locus: plateau-app
blockedBy: ["1238"]
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "plateau:src/marketing/legal.ts"
tags: [plateau, plateau-app, logged-off, legal, 404]
---

# Supporting public pages — legal + public 404

S5 of #1237. Fill out the remaining public chrome for the logged-off shell: legal pages (terms of service, privacy policy) and a public 404 / not-found page for unmatched routes in the unauthenticated space. New `plateau:src/marketing/legal.ts` page module(s) + route templates in [plateau:index.html](../../plateau-app/index.html), plus footer/nav links from the #1238 logged-off shell, following the existing mount pattern in [plateau:src/main.ts](../../plateau-app/src/main.ts). Candidate to render from FUI components per the #777 dogfood goal. Demoable: legal pages render and the public 404 catches an unknown logged-off route. Independent of S2/S3/S4; depends only on the #1238 shell.

## Progress

Filled out the remaining public chrome (S5 of #1237) on the #1238 shell:

- `plateau:src/marketing/legal.ts` — `mountLegal(mount, 'terms'|'privacy')` (demo Terms + Privacy copy,
  consistent with the open-core / no-real-backend posture) and `mountNotFound(mount)` (a friendly 404 that
  links to `/home`, not the auth-gated dashboard the old inline 404 pointed at). Theme-token styled (#1283).
- `plateau:index.html` — `/terms` + `/privacy` public templates; the existing `/*` catch-all converted to a
  `#notfound-mount` container.
- `plateau:src/main.ts` — added `/terms` + `/privacy` to `PUBLIC_ROUTES`; introduced a `PRODUCT_ROUTES`
  list + `isProductRoute()` so `syncAuthShell` now bounces anonymous visitors off the **product** space only
  (→ /home) and lets an **unmatched** route fall through to the public `/*` 404 instead of silently
  redirecting. Wired `tryMountLegalPage`/`tryMountNotFound` into route-change + the initial-load block.

Verified at :4000 (Playwright, logged-off): `/terms`→Terms, `/privacy`→Privacy, `/totally-bogus-xyz`→the
404 page (no bounce), and a product route (`/control-plane`) still correctly redirects to `/home`. Zero
console errors. Plateau gate green (259). This completes the #1237 logged-off public-site epic's S2–S5.
