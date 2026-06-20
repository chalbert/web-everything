---
kind: task
parent: "1237"
status: resolved
locus: plateau-app
blockedBy: ["1238"]
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "plateau:src/marketing/landing.ts"
tags: [plateau, plateau-app, logged-off, landing, marketing]
---

# Landing / marketing page (public first screen)

S2 of #1237. Build the public landing page a logged-off visitor lands on — hero, value proposition, and product overview for the Plateau enterprise front-end platform. Mounts inside the logged-off shell from #1238 (its public `/` or `/home` route template in [plateau:index.html](../../plateau-app/index.html)), as a new `plateau:src/marketing/landing.ts` page module following the existing mount pattern in [plateau:src/main.ts](../../plateau-app/src/main.ts). Candidate to render from FUI components per the #777 dogfood goal (net-new screen, no legacy). Demoable: the page renders and links into sign-in / pricing. Independent of S3–S5; depends only on the #1238 shell.

## Progress

Built the public landing page (S2 of #1237) on the #1238 logged-off shell:

- `plateau:src/marketing/landing.ts` — `mountLanding(mount)`: hero (eyebrow + title + lede + CTA), a
  3-card value-prop grid (one catalog / contract-first / govern), and a sign-in footer; links into
  `/login` + `/pricing` via `route:link` (upgraded on render). Self-contained theme-token-driven styles
  (the #1283 DTCG layer supplies the values), injected once.
- `plateau:index.html` — new `/home` public route template with `#landing-mount`.
- `plateau:src/main.ts` — imported `mountLanding`; added a `PUBLIC_ROUTES` allowlist (`/home`, `/login`)
  and reworked `syncAuthShell` so anonymous visitors land on `/home` (the public first screen) instead of
  bouncing straight to `/login`, and logged-in users bounce off the public-only routes back into the app;
  `tryMountLanding()` wired into route-change. (#1240–#1242 extend `PUBLIC_ROUTES`.)

Verified at :4000 (Playwright): anonymous `/` redirects to `/home`, the logged-off shell renders the
landing (hero title, 3 feature cards, CTA → /login + /pricing), zero console errors. Plateau gate green
(259 tests). Candidate to re-render from FUI components per #777 once the mapped blocks ship.
