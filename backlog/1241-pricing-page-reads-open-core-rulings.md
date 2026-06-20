---
kind: task
parent: "1237"
status: resolved
locus: plateau-app
blockedBy: ["1238"]
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "plateau:src/marketing/pricing.ts"
tags: [plateau, plateau-app, logged-off, pricing, monetization]
---

# Pricing page (reads open-core rulings)

S4 of #1237. Build the public pricing page for the logged-off shell. The tier structure and copy **read** the already-ratified open-core monetization rulings (#089–#093, #775) — open is free, paid is licensed; it cites them rather than re-deciding pricing here (monetization is soft-accepted and revisitable, so no fork). New `plateau:src/marketing/pricing.ts` page module + a public route template in [plateau:index.html](../../plateau-app/index.html), following the existing mount pattern in [plateau:src/main.ts](../../plateau-app/src/main.ts). Candidate to render from FUI components per the #777 dogfood goal. Demoable: pricing renders in the public shell and links into sign-up. Independent of S2/S3/S5; depends only on the #1238 shell.

## Progress

Built the public pricing page (S4 of #1237) on the #1238 shell, reading the ratified open-core rulings:

- `plateau:src/marketing/pricing.ts` — `mountPricing(mount)`: a 3-tier grid (Open=Free / Pro=Licensed
  [featured] / Enterprise=Custom) whose structure + copy CITE the open-core rulings #089–#093 / #775 —
  the paid line is drawn on the structural property (self-hosted vs hosted/credential-holding, #775 Fork-2),
  NOT open-vs-proprietary; a footer notes the rulings and that pricing is revisitable (no fork re-decided
  here). Tier CTAs link to `/signup`. Self-contained theme-token styles (#1283).
- `plateau:index.html` — `/pricing` public route template with `#pricing-mount`.
- `plateau:src/main.ts` — imported `mountPricing`; added `/pricing` to `PUBLIC_ROUTES`; `tryMountPricing()`
  wired into route-change + the initial-load block.

Verified at :4000 (Playwright): `/pricing` renders 3 tiers (Pro featured) in the logged-off shell, all
CTAs → /signup, zero console errors. Plateau gate green (259). Candidate to re-render from FUI per #777.
